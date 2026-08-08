import time

import redis as redis_py

from aevora.accounts.services.redis_token_store import (
    _memory_store,
    _token_key,
    clear_memory_store,
    consume_reset_token,
    store_reset_token,
)


class TestRedisTokenStore:
    def setup_method(self):
        clear_memory_store()

    def teardown_method(self):
        clear_memory_store()

    def test_store_and_consume_token_lifecycle(self):
        token = "test-secure-token-lifecycle"
        stored = store_reset_token(token, ttl_seconds=60)
        assert stored is True

        consumed = consume_reset_token(token)
        assert consumed is True

        second_consumption = consume_reset_token(token)
        assert second_consumption is False

    def test_consume_nonexistent_token_returns_false(self):
        result = consume_reset_token("nonexistent-token-value")
        assert result is False

    def test_redis_error_falls_back_to_memory_store_on_store(self, monkeypatch):
        def mock_client():
            class FailingClient:
                def set(self, *_args, **_kwargs):
                    raise redis_py.RedisError("Redis connection refused")

            return FailingClient()

        monkeypatch.setattr("aevora.accounts.services.redis_token_store._get_client", mock_client)

        token = "fallback-memory-store-token"
        stored = store_reset_token(token, ttl_seconds=30)
        assert stored is True

        key = _token_key(token)
        assert key in _memory_store

    def test_redis_error_falls_back_to_memory_store_on_consume(self, monkeypatch):
        token = "consume-fallback-token"
        key = _token_key(token)
        _memory_store[key] = time.time() + 60

        def mock_client():
            class FailingClient:
                def getdel(self, *_args, **_kwargs):
                    raise redis_py.RedisError("Redis timeout")

            return FailingClient()

        monkeypatch.setattr("aevora.accounts.services.redis_token_store._get_client", mock_client)

        consumed = consume_reset_token(token)
        assert consumed is True
        assert key not in _memory_store

    def test_memory_store_rejects_expired_tokens(self):
        token = "expired-memory-token"
        key = _token_key(token)
        _memory_store[key] = time.time() - 10

        consumed = consume_reset_token(token)
        assert consumed is False

    def test_token_key_generation_is_deterministic(self):
        token = "sample-token-string"
        key1 = _token_key(token)
        key2 = _token_key(token)

        assert key1 == key2
        assert key1.startswith("pwd_reset:")
