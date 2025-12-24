"""
Redis-based Conversation Memory Manager for Viva Mama Chatbot

IMPORTANT FIX: This version uses Redis Lists consistently for all operations.
- append() uses RPUSH (atomic list operations)
- load() uses LRANGE (reads from list)
- save() uses RPUSH (writes to list)

This fixes the WRONGTYPE error that occurred when mixing String and List operations.

Usage:
    from app.memory.redis_memory import RedisSessionMemory
    
    # Initialize with window size
    memory = RedisSessionMemory(window_size=6)
    
    # Ensure session ID
    session_id = memory.ensure_session_id(None)  # Generates new UUID
    
    # Append messages
    memory.append(session_id, "user", "Hello!")
    memory.append(session_id, "assistant", "Hi there!")
    
    # Load conversation
    turns = memory.load(session_id)
    
    # Get metrics
    metrics = memory.get_metrics()

Author: Viva Mama Team
"""

from __future__ import annotations

import json
import uuid
import time
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass

import redis
from redis.exceptions import RedisError, ConnectionError as RedisConnectionError

from app.settings import settings

# Configure logging
logger = logging.getLogger(__name__)

# Constants
MAX_CONTENT_LENGTH = 4000  # Max characters per message
MAX_ROLE_LENGTH = 20       # Max characters for role
MAX_RETRIES = 3            # Retry attempts for transient errors
RETRY_DELAY = 0.1          # Seconds between retries


# ============================================
# TYPE DEFINITIONS
# ============================================

@dataclass
class Turn:
    """Represents a single conversation turn"""
    role: str
    content: str
    timestamp: Optional[str] = None


@dataclass
class SessionMetadata:
    """Metadata for a conversation session"""
    session_id: str
    created_at: datetime
    last_accessed: datetime
    turn_count: int
    total_size_bytes: int


# ============================================
# METRICS TRACKING
# ============================================

class _MemoryMetrics:
    """Tracks memory operations for monitoring"""
    
    def __init__(self):
        self.operations = {
            "load": 0,
            "save": 0,
            "append": 0,
            "delete": 0,
            "fallback_used": 0,
            "migrations": 0
        }
        self.errors = {
            "redis_connection": 0,
            "parse_error": 0,
            "retry_exhausted": 0
        }
        self.latency = {
            "load_ms": [],
            "save_ms": [],
            "append_ms": []
        }
    
    def record_operation(self, op_type: str, latency_ms: float = None):
        """Record an operation"""
        self.operations[op_type] = self.operations.get(op_type, 0) + 1
        if latency_ms and op_type in self.latency:
            self.latency[op_type].append(latency_ms)
            # Keep only last 100 samples
            if len(self.latency[op_type]) > 100:
                self.latency[op_type] = self.latency[op_type][-100:]
    
    def record_error(self, error_type: str):
        """Record an error"""
        self.errors[error_type] = self.errors.get(error_type, 0) + 1
    
    def get_stats(self) -> Dict[str, Any]:
        """Get current statistics"""
        stats = {
            "operations": dict(self.operations),
            "errors": dict(self.errors)
        }
        
        # Calculate latency percentiles
        for op_type, samples in self.latency.items():
            if samples:
                sorted_samples = sorted(samples)
                stats[f"{op_type}_p50"] = sorted_samples[len(sorted_samples) // 2]
                stats[f"{op_type}_p95"] = sorted_samples[int(len(sorted_samples) * 0.95)]
                stats[f"{op_type}_p99"] = sorted_samples[int(len(sorted_samples) * 0.99)]
        
        return stats


# Global metrics instance
_metrics = _MemoryMetrics()


# ============================================
# IN-PROCESS FALLBACK STORE
# ============================================

class _InProcessStore:
    """
    Minimal in-process fallback store when Redis is unavailable.
    """
    def __init__(self, window_size: int):
        self.window_size = window_size
        self._data: Dict[str, List[Dict[str, Any]]] = {}
        self._expiry: Dict[str, datetime] = {}
        self._metadata: Dict[str, SessionMetadata] = {}
    
    def lrange(self, key: str, start: int, end: int) -> List[str]:
        """Get range of items from list (mimics Redis LRANGE)"""
        self._cleanup_expired()
        
        if key in self._expiry and datetime.now() > self._expiry[key]:
            self.delete(key)
            return []
        
        turns = self._data.get(key, [])
        return [json.dumps(turn) for turn in turns]
    
    def rpush(self, key: str, *values: str) -> int:
        """Append items to list (mimics Redis RPUSH)"""
        if key not in self._data:
            self._data[key] = []
        
        for value in values:
            turn = json.loads(value)
            self._data[key].append(turn)
        
        return len(self._data[key])
    
    def ltrim(self, key: str, start: int, end: int) -> None:
        """Trim list to specified range (mimics Redis LTRIM)"""
        if key in self._data:
            if start < 0 and end == -1:
                # Keep last N items
                self._data[key] = self._data[key][start:]
    
    def expire(self, key: str, seconds: int) -> None:
        """Set expiration time"""
        self._expiry[key] = datetime.now() + timedelta(seconds=seconds)
    
    def delete(self, key: str) -> None:
        """Delete key and metadata"""
        self._data.pop(key, None)
        self._expiry.pop(key, None)
        self._metadata.pop(key, None)
    
    def type(self, key: str) -> str:
        """Get type of key (always returns 'list' for consistency)"""
        if key in self._data:
            return 'list'
        return 'none'
    
    def _cleanup_expired(self) -> None:
        """Remove expired keys"""
        now = datetime.now()
        expired_keys = [k for k, exp in self._expiry.items() if now > exp]
        for key in expired_keys:
            self.delete(key)
    
    def keys(self, pattern: str = "*") -> List[str]:
        """List all keys"""
        self._cleanup_expired()
        return list(self._data.keys())
    
    def ttl(self, key: str) -> int:
        """Get time to live for key"""
        if key in self._expiry:
            remaining = (self._expiry[key] - datetime.now()).total_seconds()
            return int(remaining) if remaining > 0 else -1
        return -1


# ============================================
# MAIN REDIS SESSION MEMORY CLASS
# ============================================

class RedisSessionMemory:
    """
    Redis-backed conversation memory using Lists for atomic operations.
    
    Storage model:
      Key    : "chat:session:{session_id}"
      Value  : Redis List where each item is a JSON-encoded turn
      Window : Keep only last N turns (FIFO, atomic via LTRIM)
      TTL    : settings.memory_ttl_seconds (refreshed on each operation)

    This version uses Redis Lists consistently to avoid WRONGTYPE errors.
    """

    def __init__(self, window_size: int = 6):
        """
        Initialize memory manager.
        
        Args:
            window_size: Maximum number of turns to keep per session
        """
        self.window_size = max(1, int(window_size))
        self.ttl = int(settings.memory_ttl_seconds)

        # Connection pooling
        self._is_fallback = False
        try:
            self._r = redis.from_url(
                settings.redis_url,
                decode_responses=False,  # We handle encoding
                max_connections=50,
                socket_timeout=5,
                socket_connect_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30
            )
            # Quick health check
            self._check_redis_health()
            logger.info("Redis connection established with pooling (max_connections=50)")
        except (RedisConnectionError, RedisError) as e:
            logger.warning(f"Redis unavailable, using in-process fallback: {str(e)}")
            self._is_fallback = True
            self._r = _InProcessStore(window_size=self.window_size)
            _metrics.record_operation("fallback_used")

    # -------------------------------
    # Internal helpers
    # -------------------------------

    def _key(self, session_id: str) -> str:
        """Generate Redis key for session"""
        return f"chat:session:{session_id}"

    def _check_redis_health(self) -> bool:
        """Check if Redis is healthy"""
        if self._is_fallback:
            return False
        
        try:
            self._r.ping()
            return True
        except (RedisConnectionError, RedisError) as e:
            logger.error(f"Redis health check failed: {str(e)}")
            _metrics.record_error("redis_connection")
            return False
    
    def _switch_to_fallback(self) -> None:
        """Switch to fallback mode when Redis fails"""
        if not self._is_fallback:
            logger.error("Switching to in-process fallback mode due to Redis failure")
            self._is_fallback = True
            self._r = _InProcessStore(window_size=self.window_size)
            _metrics.record_operation("fallback_used")
    
    def _retry_operation(self, operation, *args, **kwargs):
        """Retry operation with exponential backoff"""
        last_exception = None
        
        for attempt in range(MAX_RETRIES):
            try:
                return operation(*args, **kwargs)
            except (RedisConnectionError, RedisError) as e:
                last_exception = e
                _metrics.record_error("redis_connection")
                
                if attempt < MAX_RETRIES - 1:
                    wait_time = RETRY_DELAY * (2 ** attempt)
                    logger.warning(
                        f"Redis operation failed (attempt {attempt + 1}/{MAX_RETRIES}), "
                        f"retrying in {wait_time}s: {str(e)}"
                    )
                    time.sleep(wait_time)
                else:
                    logger.error(f"Redis operation failed after {MAX_RETRIES} attempts")
                    _metrics.record_error("retry_exhausted")
                    self._switch_to_fallback()
                    raise last_exception
        
        raise last_exception

    @staticmethod
    def generate_session_id() -> str:
        """Generate a unique session ID"""
        return str(uuid.uuid4())

    def ensure_session_id(self, session_id: Optional[str]) -> str:
        """Ensure we have a valid session ID"""
        if session_id:
            return session_id
        return self.generate_session_id()

    # -------------------------------
    # Core CRUD operations (List-based)
    # -------------------------------

    def load(self, session_id: str) -> List[Dict[str, Any]]:
        """
        Load conversation turns for a session using Redis Lists.
        
        This method uses LRANGE to read from a Redis List, which is consistent
        with the atomic append() operation that uses RPUSH.
        
        Includes automatic migration for sessions stored in the old String format.
        
        Args:
            session_id: Unique session identifier
            
        Returns:
            List of turns (may be empty)
        """
        start_time = time.perf_counter()
        
        try:
            key = self._key(session_id)
            
            if self._is_fallback:
                # Fallback: use list operations
                raw_list = self._r.lrange(key, 0, -1)
                
                turns = []
                for turn_json in raw_list:
                    try:
                        turn = json.loads(turn_json)
                        if isinstance(turn, dict) and "role" in turn and "content" in turn:
                            turns.append(turn)
                    except json.JSONDecodeError:
                        continue
            else:
                # Check what type of data structure exists
                key_type = self._retry_operation(self._r.type, key)
                
                if key_type == b'none' or key_type == 'none':
                    # Key doesn't exist - return empty list
                    turns = []
                
                elif key_type == b'list' or key_type == 'list':
                    # CORRECT FORMAT: Redis List
                    # Use LRANGE to get all items
                    raw_list = self._retry_operation(self._r.lrange, key, 0, -1)
                    
                    turns = []
                    for turn_json in raw_list:
                        try:
                            # Decode bytes to string
                            turn_str = turn_json.decode('utf-8') if isinstance(turn_json, bytes) else turn_json
                            turn = json.loads(turn_str)
                            
                            if isinstance(turn, dict) and "role" in turn and "content" in turn:
                                turns.append(turn)
                            else:
                                logger.warning(f"Invalid turn structure: {turn}")
                        except (json.JSONDecodeError, UnicodeDecodeError) as e:
                            logger.error(f"Failed to parse turn: {str(e)}")
                            continue
                
                elif key_type == b'string' or key_type == 'string':
                    # OLD FORMAT: Redis String - migrate automatically
                    logger.info(f"Migrating session {session_id} from String to List format")
                    _metrics.record_operation("migrations")
                    
                    try:
                        # Read old format (compressed JSON string)
                        raw = self._retry_operation(self._r.get, key)
                        
                        # Try to parse old format
                        if raw:
                            # Handle potential compression
                            if raw.startswith(b"GZIP:"):
                                import gzip
                                compressed = raw[5:]
                                decompressed = gzip.decompress(compressed)
                                json_str = decompressed.decode('utf-8')
                            else:
                                json_str = raw.decode('utf-8')
                            
                            old_turns = json.loads(json_str)
                            
                            if isinstance(old_turns, list):
                                turns = [t for t in old_turns if isinstance(t, dict) and "role" in t and "content" in t]
                            else:
                                turns = []
                        else:
                            turns = []
                        
                        # Delete old format
                        self._retry_operation(self._r.delete, key)
                        
                        # Save in new List format if we have data
                        if turns:
                            pipe = self._r.pipeline()
                            for turn in turns[-self.window_size:]:  # Only keep window size
                                turn_json = json.dumps(turn, ensure_ascii=False)
                                pipe.rpush(key, turn_json)
                            pipe.expire(key, self.ttl)
                            self._retry_operation(pipe.execute)
                            
                            logger.info(f"Successfully migrated {len(turns)} turns to List format")
                    
                    except Exception as e:
                        logger.error(f"Failed to migrate session {session_id}: {str(e)}")
                        # Delete corrupt data and start fresh
                        self._retry_operation(self._r.delete, key)
                        turns = []
                
                else:
                    # Unknown type - delete and start fresh
                    logger.error(f"Unknown Redis type '{key_type}' for {session_id}, deleting")
                    self._retry_operation(self._r.delete, key)
                    turns = []
            
            # Enforce window size
            if len(turns) > self.window_size:
                logger.warning(f"Session {session_id} has {len(turns)} turns, trimming to {self.window_size}")
                turns = turns[-self.window_size:]
            
            # Record metrics
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            _metrics.record_operation("load", elapsed_ms)
            
            logger.debug(f"Loaded {len(turns)} turns for {session_id} in {elapsed_ms:.2f}ms")
            
            return turns
            
        except Exception as e:
            logger.error(f"Error loading session {session_id}: {str(e)}", exc_info=True)
            return []

    def save(self, session_id: str, turns: List[Dict[str, Any]]) -> None:
        """
        Save conversation turns using Redis Lists.
        
        This replaces the entire conversation by deleting the old list
        and creating a new one. Used primarily by import_session().
        
        Args:
            session_id: Unique session identifier
            turns: List of turn dictionaries
        """
        start_time = time.perf_counter()
        
        try:
            key = self._key(session_id)
            
            # Enforce window size
            if len(turns) > self.window_size:
                turns = turns[-self.window_size:]
            
            if self._is_fallback:
                # Fallback: delete and recreate
                self._r.delete(key)
                if turns:
                    for turn in turns:
                        turn_json = json.dumps(turn, ensure_ascii=False)
                        self._r.rpush(key, turn_json)
                    self._r.expire(key, self.ttl)
            else:
                # Redis: delete old data and create new list
                pipe = self._r.pipeline()
                pipe.delete(key)
                
                if turns:
                    # Add all turns to the list
                    for turn in turns:
                        # Ensure timestamp exists
                        if "timestamp" not in turn:
                            turn["timestamp"] = datetime.now().isoformat()
                        
                        turn_json = json.dumps(turn, ensure_ascii=False)
                        pipe.rpush(key, turn_json)
                    
                    pipe.expire(key, self.ttl)
                
                self._retry_operation(pipe.execute)
            
            # Record metrics
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            _metrics.record_operation("save", elapsed_ms)
            
            logger.debug(f"Saved {len(turns)} turns for {session_id} in {elapsed_ms:.2f}ms")
            
        except Exception as e:
            logger.error(f"Error saving session {session_id}: {str(e)}", exc_info=True)

    def append(self, session_id: str, role: str, content: str) -> List[Dict[str, Any]]:
        """
        Append a turn to the conversation using atomic Redis List operations.
        
        This uses RPUSH + LTRIM + EXPIRE in a pipeline for atomicity,
        preventing race conditions when multiple requests happen simultaneously.
        
        Args:
            session_id: Unique session identifier
            role: Message role ('user' or 'assistant')
            content: Message content
            
        Returns:
            Updated list of turns
        """
        start_time = time.perf_counter()
        
        try:
            key = self._key(session_id)
            
            # Create turn with timestamp
            turn = {
                "role": role[:MAX_ROLE_LENGTH],
                "content": content[:MAX_CONTENT_LENGTH],
                "timestamp": datetime.now().isoformat()
            }
            
            # Log if content was truncated
            if len(content) > MAX_CONTENT_LENGTH:
                logger.warning(f"Content truncated from {len(content)} to {MAX_CONTENT_LENGTH} chars")
            
            turn_json = json.dumps(turn, ensure_ascii=False)
            
            if self._is_fallback:
                # Fallback: not atomic but good enough for single process
                self._r.rpush(key, turn_json)
                self._r.ltrim(key, -self.window_size, -1)
                self._r.expire(key, self.ttl)
                result = self.load(session_id)
            else:
                # ATOMIC operation using Redis pipeline
                pipe = self._r.pipeline()
                pipe.rpush(key, turn_json)                    # Append to list
                pipe.ltrim(key, -self.window_size, -1)        # Keep last N items
                pipe.expire(key, self.ttl)                    # Refresh TTL
                
                self._retry_operation(pipe.execute)
                
                # Load the updated conversation
                result = self.load(session_id)
            
            # Record metrics
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            _metrics.record_operation("append", elapsed_ms)
            
            logger.debug(f"Appended turn to {session_id} in {elapsed_ms:.2f}ms")
            
            return result
            
        except Exception as e:
            logger.error(f"Error appending to {session_id}: {str(e)}", exc_info=True)
            # Fallback: load + append + save (less safe but better than crash)
            turns = self.load(session_id)
            turns.append(turn)
            self.save(session_id, turns)
            return turns

    def reset(self, session_id: str) -> None:
        """Delete all turns for a session"""
        try:
            key = self._key(session_id)
            
            if self._is_fallback:
                self._r.delete(key)
            else:
                self._retry_operation(self._r.delete, key)
            
            _metrics.record_operation("delete")
            logger.info(f"Reset session {session_id}")
            
        except Exception as e:
            logger.error(f"Error resetting {session_id}: {str(e)}", exc_info=True)

    # -------------------------------
    # Convenience helpers
    # -------------------------------

    def get_last_n(self, session_id: str, n: int = 4) -> List[Dict[str, Any]]:
        """Get last N turns from session"""
        turns = self.load(session_id)
        if n <= 0:
            return []
        return turns[-n:]

    def append_many(self, session_id: str, new_turns: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Append multiple turns at once"""
        turns = self.load(session_id)
        for t in new_turns:
            role = str(t.get("role", ""))[:MAX_ROLE_LENGTH]
            content = str(t.get("content", ""))[:MAX_CONTENT_LENGTH]
            turns.append({
                "role": role,
                "content": content,
                "timestamp": t.get("timestamp", datetime.now().isoformat())
            })
        self.save(session_id, turns)
        return turns

    # -------------------------------
    # Session management
    # -------------------------------

    def list_sessions(self, pattern: str = "chat:session:*") -> List[str]:
        """List all active sessions"""
        try:
            if self._is_fallback:
                keys = self._r.keys(pattern)
                return [k.replace("chat:session:", "") for k in keys]
            else:
                keys = self._retry_operation(self._r.keys, pattern)
                return [k.decode('utf-8').replace("chat:session:", "") for k in keys]
        except Exception as e:
            logger.error(f"Error listing sessions: {str(e)}")
            return []

    def export_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Export session data for backup"""
        try:
            turns = self.load(session_id)
            
            return {
                "session_id": session_id,
                "turns": turns,
                "metadata": {
                    "turn_count": len(turns),
                    "window_size": self.window_size,
                    "exported_at": datetime.now().isoformat()
                }
            }
        except Exception as e:
            logger.error(f"Error exporting {session_id}: {str(e)}")
            return None

    def import_session(self, session_id: str, data: Dict[str, Any], overwrite: bool = False) -> bool:
        """Import session data from backup"""
        try:
            # Check if session exists
            existing = self.load(session_id)
            if existing and not overwrite:
                logger.warning(f"Session {session_id} exists, use overwrite=True")
                return False
            
            # Validate data
            if "turns" not in data:
                logger.error("Invalid import data: missing 'turns'")
                return False
            
            # Import turns
            self.save(session_id, data["turns"])
            logger.info(f"Imported {len(data['turns'])} turns for {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error importing {session_id}: {str(e)}")
            return False

    # -------------------------------
    # Properties and metrics
    # -------------------------------

    @property
    def using_fallback(self) -> bool:
        """Check if using fallback mode"""
        return self._is_fallback

    @property
    def ttl_seconds(self) -> int:
        """Get configured TTL"""
        return self.ttl

    def get_metrics(self) -> Dict[str, Any]:
        """Get memory metrics"""
        stats = _metrics.get_stats()
        stats["using_fallback"] = self._is_fallback
        stats["window_size"] = self.window_size
        stats["ttl_seconds"] = self.ttl
        return stats

    def health_check(self) -> Dict[str, Any]:
        """Check health of memory system"""
        health = {
            "status": "healthy",
            "redis_available": not self._is_fallback,
            "using_fallback": self._is_fallback,
            "metrics": self.get_metrics()
        }
        
        if not self._is_fallback:
            redis_healthy = self._check_redis_health()
            if not redis_healthy:
                health["status"] = "degraded"
                health["redis_available"] = False
        
        return health