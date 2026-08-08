import hashlib
import logging
import os
import time

import redis as redis_py
from django.conf import settings

logger = logging.getLogger(__name__)

_RESET_TOKEN_PREFIX = "pwd_reset"
_client = None
_memory_store: dict[str, float] = {}


def _get_client():
    global _client
    if _client is None:
        redis_url = getattr(
            settings,
            "REDIS_URL",
            os.environ.get("REDIS_URL", "redis://localhost:6379/0"),
        )
        _client = redis_py.Redis.from_url(
            redis_url,
            decode_responses=True,
            socket_connect_timeout=1,
            socket_timeout=1,
            retry_on_timeout=False,
        )
    return _client


def _token_key(token: str) -> str:
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    return f"{_RESET_TOKEN_PREFIX}:{token_hash}"


def store_reset_token(token: str, ttl_seconds: int) -> bool:
    key = _token_key(token)
    try:
        client = _get_client()
        client.set(key, "1", ex=ttl_seconds)
        return True
    except redis_py.RedisError as exc:
        logger.warning("Redis token store unavailable: %s", exc)
        _memory_store[key] = time.time() + ttl_seconds
        return True


def consume_reset_token(token: str) -> bool:
    key = _token_key(token)
    try:
        client = _get_client()
        result = client.getdel(key)
        if result is not None:
            return True
        if result is None and key not in _memory_store:
            return False
    except redis_py.RedisError as exc:
        logger.warning("Redis token store unavailable: %s", exc)

    now = time.time()
    if key in _memory_store:
        expiry = _memory_store.pop(key)
        return now <= expiry

    return False


def clear_memory_store() -> None:
    _memory_store.clear()
