"""
LactMed lookup — resolve a drug/medicine from free text and build a grounded
context block for the chat pipeline.

Data source: lactmed.json, built by build_lactmed.py from NCBI/NIH LactMed
(NBK501922). Structure:

    {
      "drugs":   { "<drug key>": { name, synonyms, revised, summary,
                                   drug_class, sections{...} }, ... },
      "aliases": { "<brand/synonym>": "<drug key>", ... }
    }

The whole dataset (~10 MB, ~1,900 drugs / ~39,000 aliases) is loaded ONCE into
module-level globals on first use. Lookups are then O(1) dict hits — far more
reliable for exact drug/brand names than semantic search over the vector index.
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# lactmed.json lives at the repo root: <repo>/app/lactmed/lookup.py -> parents[2]
_DEFAULT_JSON_PATH = Path(__file__).resolve().parents[2] / "lactmed.json"

# Sections worth showing for a breastfeeding-safety answer (in priority order).
# Everything else in the record (CAS numbers, substance names, references) is noise.
_SAFETY_SECTIONS = [
    "Summary of Use during Lactation",
    "Drug Levels",
    "Effects in Breastfed Infants",
    "Effects on Lactation and Breastmilk",
]

# Breastfeeding / lactation cues. A LactMed answer is only triggered when one of
# these appears AND a drug name resolves — this keeps the branch from hijacking
# unrelated questions that merely mention a medicine.
_BREASTFEEDING_CUES = re.compile(
    r"\b("
    r"breast[\s-]?feed(?:ing|s)?|breastfed|"
    r"nursing|nurse|"
    r"lactat(?:e|ing|ion)|"
    r"breast[\s-]?milk|"
    r"while\s+feeding|during\s+feeding"
    r")\b",
    re.IGNORECASE,
)

# Single-token drug candidates shorter than this are ignored to avoid matching
# noise aliases; multi-word n-grams are always considered.
_MIN_TOKEN_LEN = 4
_MAX_NGRAM = 4

# Common words that happen to exist as short LactMed aliases — never treat a bare
# occurrence of these as a drug mention.
_STOPWORDS = {
    "safe",
    "take",
    "milk",
    "water",
    "acid",
    "gas",
    "oil",
    "iron",
    "cold",
    "is",
    "it",
    "the",
    "a",
    "an",
    "for",
    "and",
    "or",
    "of",
    "to",
    "my",
    "can",
    "i",
    "while",
    "during",
    "with",
    "this",
    "that",
    "baby",
}

# Module-level cache (populated lazily by _get_data()).
_DRUGS: Optional[Dict[str, Any]] = None
_ALIASES: Optional[Dict[str, str]] = None


def _get_data() -> tuple[Dict[str, Any], Dict[str, str]]:
    """Load lactmed.json once and cache it in module globals."""
    global _DRUGS, _ALIASES
    if _DRUGS is None:
        try:
            with open(_DEFAULT_JSON_PATH, encoding="utf-8") as f:
                data = json.load(f)
            _DRUGS = data.get("drugs", {})
            _ALIASES = data.get("aliases", {})
            logger.info(
                "LactMed loaded: %d drugs, %d aliases from %s",
                len(_DRUGS),
                len(_ALIASES),
                _DEFAULT_JSON_PATH,
            )
        except (OSError, json.JSONDecodeError) as e:
            logger.error("Failed to load LactMed data (%s): %s", _DEFAULT_JSON_PATH, e)
            _DRUGS, _ALIASES = {}, {}
    return _DRUGS, _ALIASES  # type: ignore[return-value]


def _candidate_ngrams(text: str) -> List[str]:
    """Yield lowercase 1..N-word n-grams from text, longest first.

    Longest-first ordering means a multi-word brand ("botulinum toxin a")
    resolves before any single word inside it.
    """
    tokens = re.findall(r"[a-z0-9]+", text.lower())
    ngrams: List[str] = []
    for n in range(min(_MAX_NGRAM, len(tokens)), 0, -1):
        for i in range(len(tokens) - n + 1):
            ngrams.append(" ".join(tokens[i : i + n]))
    return ngrams


def find_drug(text: str) -> Optional[Dict[str, Any]]:
    """Resolve a LactMed drug record from free text, or None.

    Resolution order (per n-gram, longest first): exact drug key, then alias
    map. Single short tokens and common stopwords are skipped to avoid noise.
    """
    drugs, aliases = _get_data()
    if not drugs:
        return None

    for gram in _candidate_ngrams(text):
        is_single = " " not in gram
        if is_single and (len(gram) < _MIN_TOKEN_LEN or gram in _STOPWORDS):
            continue

        key = gram if gram in drugs else aliases.get(gram)
        if key and key in drugs:
            return drugs[key]

    return None


def format_lactmed_context(drug: Dict[str, Any]) -> str:
    """Build a grounded CONTEXT block from a LactMed record.

    Includes the summary plus the safety-relevant sections and a source line
    (with revision date) so the LLM can cite LactMed.
    """
    name = drug.get("name", "This medicine")
    parts: List[str] = [f"LactMed record for {name}:"]

    sections = drug.get("sections", {}) or {}
    summary = drug.get("summary") or sections.get("Summary of Use during Lactation")

    seen = set()
    if summary:
        parts.append(f"\nSummary of Use during Lactation:\n{summary}")
        seen.add("Summary of Use during Lactation")

    for title in _SAFETY_SECTIONS:
        if title in seen:
            continue
        body = sections.get(title)
        if body:
            parts.append(f"\n{title}:\n{body}")
            seen.add(title)

    revised = drug.get("revised")
    source = "[Source: LactMed (NCBI/NIH)"
    source += f", revised {revised}]" if revised else "]"
    parts.append(f"\n{source}")

    return "\n".join(parts)


def is_lactation_query(text: str) -> Optional[Dict[str, Any]]:
    """Return the LactMed drug record iff text is a breastfeeding-safety question.

    Requires BOTH a breastfeeding/lactation cue AND a resolvable drug name.
    Returns the drug record (so callers don't look it up twice), else None.
    """
    if not text or not _BREASTFEEDING_CUES.search(text):
        return None
    return find_drug(text)
