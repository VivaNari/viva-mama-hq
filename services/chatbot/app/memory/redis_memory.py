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
            if isinstance(val, list):
                cleaned = []
                for t in val:
                    if isinstance(t, dict) and "role" in t and "content" in t:
                        content = str(t["content"])[:4000]
                        role = str(t["role"])
                        cleaned.append({"role": role, "content": content})
                return cleaned
            return []
        except Exception:
            return []

    def _dump_turns(self, turns: List[Dict[str, Any]]) -> str:
        if len(turns) > self.window_size:
            turns = turns[-self.window_size:]
        # Ensure minimal schema and truncate content length to guard size.
        safe_turns = []
        for t in turns:
            role = str(t.get("role", ""))[:20]
            content = str(t.get("content", ""))[:4000]
            safe_turns.append({"role": role, "content": content})
        return json.dumps(safe_turns, ensure_ascii=False)

    @staticmethod
    def generate_session_id() -> str:
        return str(uuid.uuid4())

    def ensure_session_id(self, session_id: Optional[str]) -> str:
        if session_id:
            return session_id
        return self.generate_session_id()

    def load(self, session_id: str) -> List[Dict[str, Any]]:
        key = self._key(session_id)
        raw = self._r.get(key)
        turns = self._parse_turns(raw)
        if raw and not turns:
            # Corrupt → wipe it
            self._r.delete(key)
            return []
        return turns

    def save(self, session_id: str, turns: List[Dict[str, Any]]) -> None:
        key = self._key(session_id)
        payload = self._dump_turns(turns)
        if not self._is_fallback:
            self._r.set(key, payload, ex=self.ttl)
        else:
            self._r.set(key, payload)

    def append(self, session_id: str, role: str, content: str) -> List[Dict[str, Any]]:
        turns = self.load(session_id)
        turns.append({"role": role, "content": content})
        self.save(session_id, turns)
        return turns

    def reset(self, session_id: str) -> None:
        key = self._key(session_id)
        self._r.delete(key)

    # Convenience helpers (optional but handy in notebooks / APIs)

    def get_last_n(self, session_id: str, n: int = 4) -> List[Dict[str, Any]]:
        turns = self.load(session_id)
        if n <= 0:
            return []
        return turns[-n:]

    def append_many(self, session_id: str, new_turns: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        turns = self.load(session_id)
        for t in new_turns:
            role = str(t.get("role", ""))[:20]
            content = str(t.get("content", ""))[:4000]
            turns.append({"role": role, "content": content})
        self.save(session_id, turns)
        return turns

    @property
    def using_fallback(self) -> bool:
        return self._is_fallback

    @property
    def ttl_seconds(self) -> int:
        return self.ttl
