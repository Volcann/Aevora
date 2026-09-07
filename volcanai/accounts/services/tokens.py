from datetime import UTC, datetime, timedelta

import jwt
from django.conf import settings
from rest_framework_simplejwt.exceptions import TokenBackendError, TokenError
from rest_framework_simplejwt.state import token_backend

ONBOARDING_PURPOSE = "set_initial_password"
RESET_PASSWORD_PURPOSE = "reset_password"


class TokenService:
    @classmethod
    def generate_token(
        cls,
        user,
        purpose: str = ONBOARDING_PURPOSE,
        expiry_hours: int | None = None,
    ) -> str:
        now = datetime.now(UTC)
        ttl = expiry_hours or getattr(settings, "ONBOARDING_TOKEN_EXPIRY_HOURS", 168)
        payload = {
            "user_id": str(user.id),
            "email": user.email,
            "purpose": purpose,
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(hours=ttl)).timestamp()),
        }
        return token_backend.encode(payload)

    @classmethod
    def generate_onboarding_token(cls, user, expiry_hours: int | None = None) -> str:
        return cls.generate_token(user, purpose=ONBOARDING_PURPOSE, expiry_hours=expiry_hours)

    @classmethod
    def generate_reset_password_token(cls, user, expiry_hours: int | None = None) -> str:
        return cls.generate_token(user, purpose=RESET_PASSWORD_PURPOSE, expiry_hours=expiry_hours)

    @staticmethod
    def decode_token(
        token: str,
        expected_purpose: str | None = None,
    ) -> tuple[dict | None, str | None]:
        try:
            payload = token_backend.decode(token)
        except (TokenError, TokenBackendError, jwt.PyJWTError) as exc:
            message = str(exc)
            if "expired" in message.lower():
                return None, "This link has expired"
            return None, "Invalid or corrupted link"

        if expected_purpose and payload.get("purpose") != expected_purpose:
            return None, "This link is not valid for this action"

        return payload, None
