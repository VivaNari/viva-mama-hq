"""Request and response of /v1/contents/draft, and the model's structured output."""

from __future__ import annotations

from typing import List, Literal, Optional
from urllib.parse import urlsplit

from pydantic import BaseModel, Field, field_validator

# The app's own category codes: pregnant, postpartum, neither.
Stage = Literal["NP", "PP", "NN"]

MAX_VIDEOS = 3

_YOUTUBE_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"}


class ContentDraftRequest(BaseModel):
    content_id: str = Field(..., min_length=1, max_length=64)
    title: str = Field(..., min_length=1, max_length=300)
    text: str = Field("", max_length=60_000)
    video_urls: List[str] = Field(default_factory=list, max_length=MAX_VIDEOS)

    @field_validator("video_urls")
    @classmethod
    def _youtube_only(cls, urls: List[str]) -> List[str]:
        # The model fetches these, so nothing but a YouTube link may be passed on.
        for url in urls:
            parts = urlsplit(url)
            if parts.scheme != "https" or (parts.hostname or "") not in _YOUTUBE_HOSTS:
                raise ValueError("video_urls must be https YouTube links")
        return urls


class ExampleQuestion(BaseModel):
    text: str = Field(description="A question in a mother's everyday words.")
    language: Literal["en", "hi", "hinglish"]
    timestamp: Optional[str] = Field(
        None, description="mm:ss where the video answers it; null if the text answers it."
    )


class SearchProfileOutput(BaseModel):
    readable: bool = Field(description="False when the supplied source could not be read.")
    summary: str = ""
    one_liner: str = ""
    keywords_en: List[str] = Field(default_factory=list)
    keywords_hi: List[str] = Field(default_factory=list)
    example_questions: List[ExampleQuestion] = Field(default_factory=list)
    suitable_for: List[Stage] = Field(default_factory=list)


class ContentDraftResponse(BaseModel):
    request_id: str
    # DRAFTED -> review it; NEEDS_MANUAL -> nothing usable, an admin writes it.
    status: Literal["DRAFTED", "NEEDS_MANUAL"]
    # True only when the model was given every video. False for a text-only fallback.
    video_checked: bool = False
    profile: Optional[SearchProfileOutput] = None
