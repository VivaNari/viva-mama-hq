"""
Provider-agnostic LLM factory.

`get_llm(model)` returns a LangChain chat model the pipeline calls `.invoke()` on
— exactly the same interface the old Groq client exposed, so the rest of the app
is unchanged. The backend is chosen by `settings.llm_provider`:

- "vertex" (default): Gemini on Google Vertex AI. Auth via Application Default
  Credentials (the Cloud Run runtime SA in prod; `gcloud auth
  application-default login` locally). No API key.
- "groq": the legacy Groq path (delegates to app.llm.groq_client), kept as a
  one-flag rollback.

Clients are cached per (provider, model, temperature) so we don't rebuild them
on every request.

Safety note (important for a health app): Vertex Gemini applies content-safety
filters that can BLOCK legitimate postpartum/medical answers. We set every
category to BLOCK_ONLY_HIGH to minimize false blocks. Callers should still treat
an empty response as "no answer" and fall back gracefully (see the main
generation path in chat_pipeline_mcp).
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from app.settings import settings
from langchain_core.language_models import BaseChatModel

logger = logging.getLogger(__name__)

# Temperature by role: the scope/grounding classifier is deterministic; main
# generation + translation get a little warmth for natural language.
_MAIN_TEMPERATURE = 0.2
_CLASSIFIER_TEMPERATURE = 0.0
# Reading a report: near-deterministic, since the same report must read the same way.
_ANALYZER_TEMPERATURE = 0.1
# Summarising her stored records: the same records should summarise the same way.
_SUMMARIZER_TEMPERATURE = 0.1

# Cache built clients by config so repeated calls reuse one instance.
_clients: Dict[str, BaseChatModel] = {}


def _build_vertex(model: str, temperature: float, role: str) -> BaseChatModel:
    """Construct a ChatVertexAI client with health-appropriate safety settings."""
    # Imported lazily so the module imports even when the Vertex SDK isn't
    # installed (e.g. a Groq-only environment).
    from langchain_google_vertexai import (
        ChatVertexAI,
        HarmBlockThreshold,
        HarmCategory,
    )

    # BLOCK_ONLY_HIGH across categories: Gemini's default filters over-block
    # medical content (bleeding, mental health, medication questions), which for
    # this app would blank out legitimate answers. High-only keeps genuinely
    # unsafe output blocked while letting clinical postpartum content through.
    safety_settings = {
        HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    }

    kwargs: Dict[str, Any] = {
        "model": model,
        "location": settings.vertex_location,
        "temperature": temperature,
        "max_retries": 2,
        "safety_settings": safety_settings,
    }
    # Empty project => let the SDK infer it from ADC / environment.
    if settings.vertex_project:
        kwargs["project"] = settings.vertex_project
    # Gemini 2.5 Flash is a *thinking* model: thinking tokens are drawn from the
    # SAME max_output_tokens budget as the visible answer. Left at defaults, the
    # model spends its budget reasoning (thoughts_token_count ~1400) and the actual
    # answer comes back EMPTY or truncated mid-sentence. This app answers strictly
    # from provided context (RAG / curated content), so chain-of-thought reasoning
    # isn't needed. We disable thinking everywhere (thinking_budget=0) and size the
    # output cap per role.
    kwargs["thinking_budget"] = 0
    if role == "classifier":
        # Grounding/scope check: a single YES/NO — a tiny cap is plenty.
        kwargs["max_output_tokens"] = 16
    elif role == "extractor":
        # Structured log extraction: a small JSON object, never prose.
        kwargs["max_output_tokens"] = 1024
    elif role == "vision_classifier":
        # Attachment triage: a small JSON verdict about what the file is.
        kwargs["max_output_tokens"] = 512
    elif role == "analyzer":
        # Attachment explanation: a JSON object holding up to ~25 findings.
        kwargs["max_output_tokens"] = 4096
    elif role == "summarizer":
        # Overall health summary: a JSON object of short points across her records.
        kwargs["max_output_tokens"] = 3072
    else:
        # Main generation / translation: generous cap so structured, formatted
        # answers (bullets, product/expert sections) complete in full.
        kwargs["max_output_tokens"] = 2048

    logger.info(
        "Creating ChatVertexAI: model=%s location=%s temp=%s",
        model,
        settings.vertex_location,
        temperature,
    )
    return ChatVertexAI(**kwargs)


def get_llm(
    model: Optional[str] = None,
    *,
    classifier: bool = False,
    extractor: bool = False,
    vision_classifier: bool = False,
    analyzer: bool = False,
    summarizer: bool = False,
) -> BaseChatModel:
    """Return a chat model for `model` (default: settings.llm_model).

    Same interface as the old Groq client: the result has `.invoke(prompt)`
    returning a message with `.content`.

    `classifier=True` selects the small-output grounding/scope role (deterministic
    temperature, tiny token cap). The ROLE is passed explicitly by the caller
    rather than inferred from the model name — the main model and the classifier
    can now be the SAME model (e.g. both gemini-2.5-flash in asia-south1 where
    flash-lite isn't served), and a name-based guess would wrongly cap the main
    model's output at a few tokens.

    `extractor=True` selects the structured-extraction role used for logging from
    chat: deterministic like the classifier, but with room for a JSON object.

    `vision_classifier=True` / `analyzer=True` are the two attachment roles: the
    triage call that decides whether a file is a mother/baby health document, and
    the call that reads an accepted one. Both are deterministic (or nearly) and
    return JSON; they need a vision-capable provider (see `supports_vision`).

    `summarizer=True` is the text-only role that turns her stored per-record
    summaries into one overall health summary (JSON).
    """
    resolved = model or settings.llm_model
    if classifier or extractor or vision_classifier:
        temperature = _CLASSIFIER_TEMPERATURE
    elif analyzer:
        temperature = _ANALYZER_TEMPERATURE
    elif summarizer:
        temperature = _SUMMARIZER_TEMPERATURE
    else:
        temperature = _MAIN_TEMPERATURE
    provider = settings.llm_provider

    if classifier:
        role = "classifier"
    elif extractor:
        role = "extractor"
    elif vision_classifier:
        role = "vision_classifier"
    elif analyzer:
        role = "analyzer"
    elif summarizer:
        role = "summarizer"
    else:
        role = "main"
    cache_key = f"{provider}:{resolved}:{temperature}:{role}"
    cached = _clients.get(cache_key)
    if cached is not None:
        return cached

    if provider == "vertex":
        client = _build_vertex(resolved, temperature, role)
    elif provider == "groq":
        # Delegate to the legacy client (its own caching/resilience applies).
        from app.llm.groq_client import get_llm as _groq_get_llm

        client = _groq_get_llm(resolved)
    else:  # pragma: no cover - guarded by settings Literal
        raise ValueError(f"Unknown llm_provider: {provider!r}")

    _clients[cache_key] = client
    return client


def supports_vision() -> bool:
    """Whether the active provider can read images and PDFs. Groq's models cannot."""
    return settings.llm_provider == "vertex"


def get_llm_metrics() -> Dict[str, Any]:
    """Return LLM usage metrics.

    Delegates to the Groq client's tracker when that provider is active; Vertex
    usage is observable via Cloud Monitoring, so this returns a light summary.
    """
    if settings.llm_provider == "groq":
        from app.llm.groq_client import get_llm_metrics as _groq_metrics

        return _groq_metrics()
    return {"provider": "vertex", "note": "See Vertex AI metrics in Cloud Monitoring."}
