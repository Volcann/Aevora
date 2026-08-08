from datetime import UTC, datetime, timedelta

import jwt
import pytest

from aevora.accounts.services.tokens import (
    ONBOARDING_PURPOSE,
    RESET_PASSWORD_PURPOSE,
    TokenService,
)


@pytest.mark.django_db
class TestTokenService:
    def test_generate_token_contains_expected_payload(self, user):
        token = TokenService.generate_token(
            user=user,
            purpose=RESET_PASSWORD_PURPOSE,
            expiry_hours=2,
        )

        payload, error = TokenService.decode_token(
            token,
            expected_purpose=RESET_PASSWORD_PURPOSE,
        )

        assert error is None
        assert payload is not None
        assert payload["user_id"] == str(user.id)
        assert payload["email"] == user.email
        assert payload["purpose"] == RESET_PASSWORD_PURPOSE
        assert "iat" in payload
        assert "exp" in payload
        assert payload["exp"] > payload["iat"]

    def test_decode_token_fails_on_purpose_mismatch(self, user):
        token = TokenService.generate_token(
            user=user,
            purpose=ONBOARDING_PURPOSE,
        )

        payload, error = TokenService.decode_token(
            token,
            expected_purpose=RESET_PASSWORD_PURPOSE,
        )

        assert payload is None
        assert error == "This link is not valid for this action"

    def test_decode_token_fails_on_corrupted_token(self):
        payload, error = TokenService.decode_token("not.a.valid.jwt")

        assert payload is None
        assert error == "Invalid or corrupted link"

    def test_decode_token_detects_expired_token(self, user, monkeypatch):
        past_time = datetime.now(UTC) - timedelta(hours=10)
        token = TokenService.generate_token(
            user=user,
            purpose=ONBOARDING_PURPOSE,
            expiry_hours=1,
        )

        def mock_now(_tz):
            return past_time

        monkeypatch.setattr(
            "rest_framework_simplejwt.state.token_backend.decode",
            lambda _t: (_ for _ in ()).throw(jwt.ExpiredSignatureError("Signature has expired")),
        )

        payload, error = TokenService.decode_token(token)

        assert payload is None
        assert error == "This link has expired"

    def test_generate_onboarding_token_alias(self, onboarding_user):
        token = TokenService.generate_onboarding_token(onboarding_user)
        payload, error = TokenService.decode_token(token, expected_purpose=ONBOARDING_PURPOSE)

        assert error is None
        assert payload["user_id"] == str(onboarding_user.id)
        assert payload["purpose"] == ONBOARDING_PURPOSE

    def test_generate_reset_password_token_alias(self, user):
        token = TokenService.generate_reset_password_token(user)
        payload, error = TokenService.decode_token(token, expected_purpose=RESET_PASSWORD_PURPOSE)

        assert error is None
        assert payload["user_id"] == str(user.id)
        assert payload["purpose"] == RESET_PASSWORD_PURPOSE
