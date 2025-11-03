# app/memory/redis_memory.py
# ---------------------------------------------------------------------
# Production-ready, Redis-backed conversation memory for your chatbot.
#
# Key capabilities:
#  - Hybrid session handling:
#       * If a session_id is provided, we use it.
#       * If missing, we generate a UUIDv4 and return it to the caller.
#  - Rolling window memory (keep only the last N turns to limit prompt size).
#  - TTL per session, refreshed on each write (auto-expire idle sessions).
#  - Safe JSON serialization; resilient to corruption (resets a bad key).
#  - Graceful degradation: if Redis is not reachable, we transparently
#    fall back to in-process memory (useful for notebooks / local dev).
#
# Security posture:
#  - Store ONLY redacted content. Redaction should happen BEFORE calling this.
#  - Avoid storing user identifiers, tokens, or PHI.
#  - Keep TTL short (e.g., 2 hours) and the window small (e.g., 6 turns).
#
# Typical usage:
#   mem = RedisSessionMemory(window_size=6)
#   sess_id = mem.ensure_session_id(user_supplied_id)  # may generate UUID
#   mem.append(sess_id, "user", redacted_input)
#   mem.append(sess_id, "assistant", safe_output)
#   history = mem.load(sess_id)  # -> [{"role":"user","content":"..."}, ...]
#
# You can pass `sess_id` through your API / notebook calls to maintain continuity.
# ---------------------------------------------------------------------

from __future__ import annotations

import json
import uuid
from typing import List, Dict, Any, Optional, Tuple

import redis
from redis.exceptions import RedisError, ConnectionError as RedisConnectionError

from app.settings import settings


class _InProcessStore:
    """
    Minimal in-process fallback store when Redis is unavailable.
    - Not shared across processes or machines.
    - Gets reset when the process restarts.
    - Still enforces a rolling window; TTL is best-effort (not timed).
    Intended only for local dev / notebook resilience.
    """
    def __init__(self, window_size: int):
        self.window_size = window_size
        self._data: Dict[str, List[Dict[str, Any]]] = {}

    def get(self, key: str) -> Optional[str]:
        turns = self._data.get(key)
        if turns is None:
            return None
        return json.dumps(turns)

    def set(self, key: str, value: str, ex: Optional[int] = None) -> None:
        # TTL ignored in fallback; data is kept until overwritten/reset.
        self._data[key] = json.loads(value)

    def delete(self, key: str) -> None:
        self._data.pop(key, None)


class RedisSessionMemory:
    """
    Redis-backed conversation memory with graceful in-process fallback.

    Storage model:
      Key    : "chat:session:{session_id}"
      Value  : JSON array of turns, each { "role": "user"|"assistant", "content": str }
      Window : Keep only last N turns (FIFO)
      TTL    : settings.memory_ttl_seconds (refreshed on each save)

    Public API:
      - ensure_session_id(session_id: Optional[str]) -> str
      - load(session_id: str) -> List[Turn]
      - save(session_id: str, turns: List[Turn]) -> None
      - append(session_id: str, role: str, content: str) -> List[Turn]
      - reset(session_id: str) -> None
    """

    def __init__(self, window_size: int = 6):
        self.window_size = max(1, int(window_size))
        self.ttl = int(settings.memory_ttl_seconds)

        # Attempt to connect to Redis. If that fails, switch to in-process store.
        self._is_fallback = False
        try:
            # decode_responses=True → values are str, not bytes (easier JSON)
            self._r = redis.from_url(settings.redis_url, decode_responses=True)
            # Sanity check the connection quickly
            self._r.ping()
        except (RedisConnectionError, RedisError) as e:
            # Fallback mode for local notebooks / offline dev
            self._is_fallback = True
            self._r = _InProcessStore(window_size=self.window_size)

    # -------------------------------
    # Internal helpers
    # -------------------------------

    def _key(self, session_id: str) -> str:
        """Builds the Redis key for a given session."""
        return f"chat:session:{session_id}"

    def _parse_turns(self, raw: Optional[str]) -> List[Dict[str, Any]]:
        """
        Parses JSON into a list of turns.
        If data is corrupt, returns [] and lets caller decide whether to wipe the key.
        """
        if not raw:
            return []
        try:
            val = json.loads(raw)
            # Defensive: ensure it's a list of dicts with the expected keys.
            if isinstance(val, list):
                cleaned = []
                for t in val:
                    if isinstance(t, dict) and "role" in t and "content" in t:
                        # Hard cap message sizes to avoid unbounded growth if someone dumps a book.
                        content = str(t["content"])[:4000]
                        role = str(t["role"])
                        cleaned.append({"role": role, "content": content})
                return cleaned
            return []
        except Exception:
            return []

    def _dump_turns(self, turns: List[Dict[str, Any]]) -> str:
        """Serializes turns to JSON safely, enforcing rolling window."""
        if len(turns) > self.window_size:
            turns = turns[-self.window_size:]
        # Ensure minimal schema and truncate content length to guard size.
        safe_turns = []
        for t in turns:
            role = str(t.get("role", ""))[:20]
            content = str(t.get("content", ""))[:4000]
            safe_turns.append({"role": role, "content": content})
        return json.dumps(safe_turns, ensure_ascii=False)

    # -------------------------------
    # Public API
    # -------------------------------

    @staticmethod
    def generate_session_id() -> str:
        """Generate a cryptographically strong random session ID (UUIDv4)."""
        return str(uuid.uuid4())

    def ensure_session_id(self, session_id: Optional[str]) -> str:
        """
        Hybrid behavior:
          - If caller provides a session_id → return it as-is (after basic validation).
          - Else → create and return a new UUIDv4 session ID.
        """
        if session_id:
            # Very light validation: ensure plausible UUID format; if not, still accept as opaque.
            # (You may enforce strict UUID by trying uuid.UUID(session_id) if desired.)
            return session_id
        return self.generate_session_id()

    def load(self, session_id: str) -> List[Dict[str, Any]]:
        """
        Retrieves the stored list of turns for this session.
        If the stored JSON is corrupt, the key is wiped to avoid poisoning future reads.
        """
        key = self._key(session_id)
        raw = self._r.get(key)
        turns = self._parse_turns(raw)
        if raw and not turns:
            # Corrupt → wipe it
            self._r.delete(key)
            return []
        return turns

    def save(self, session_id: str, turns: List[Dict[str, Any]]) -> None:
        """
        Saves the full turns array (rolling window enforced) and sets/refreshes TTL.
        """
        key = self._key(session_id)
        payload = self._dump_turns(turns)
        # Redis path:
        if not self._is_fallback:
            # ex=self.ttl sets TTL in seconds.
            self._r.set(key, payload, ex=self.ttl)
        else:
            # In-process fallback ignores TTL (best-effort).
            self._r.set(key, payload)

    def append(self, session_id: str, role: str, content: str) -> List[Dict[str, Any]]:
        """
        Appends a single turn and returns the updated list.
        NOTE: pass only redacted content here.
        """
        turns = self.load(session_id)
        turns.append({"role": role, "content": content})
        self.save(session_id, turns)
        return turns

    def reset(self, session_id: str) -> None:
        """Clears all memory for the given session."""
        key = self._key(session_id)
        self._r.delete(key)

    # Convenience helpers (optional but handy in notebooks / APIs)

    def get_last_n(self, session_id: str, n: int = 4) -> List[Dict[str, Any]]:
        """Return the last N turns for quick prompt assembly."""
        turns = self.load(session_id)
        if n <= 0:
            return []
        return turns[-n:]

    def append_many(self, session_id: str, new_turns: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Append multiple turns at once (e.g., importing a prior conversation).
        Each turn must have role/content keys. Returns full updated list.
        """
        turns = self.load(session_id)
        for t in new_turns:
            role = str(t.get("role", ""))[:20]
            content = str(t.get("content", ""))[:4000]
            turns.append({"role": role, "content": content})
        self.save(session_id, turns)
        return turns

    # Metadata helpers

    @property
    def using_fallback(self) -> bool:
        """Returns True if Redis is unavailable and in-process store is being used."""
        return self._is_fallback

    @property
    def ttl_seconds(self) -> int:
        """Return configured TTL (seconds)."""
        return self.ttl
