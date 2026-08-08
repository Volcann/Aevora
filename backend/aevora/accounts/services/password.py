from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework.exceptions import AuthenticationFailed, NotFound, ValidationError

from aevora.accounts.services.redis_token_store import (
    consume_reset_token,
    store_reset_token,
)
from aevora.accounts.services.tokens import RESET_PASSWORD_PURPOSE, TokenService
from aevora.notification.services.email_service import EmailService

User = get_user_model()


class PasswordService:
    @staticmethod
    def forgot_password(user) -> None:
        token = TokenService.generate_token(user, purpose=RESET_PASSWORD_PURPOSE)
        ttl = getattr(settings, "ONBOARDING_TOKEN_EXPIRY_HOURS", 168) * 3600
        store_reset_token(token, ttl)

        base_url = (getattr(settings, "APP_BASE_URL", None) or "http://localhost:3000").rstrip("/")
        path = getattr(settings, "RESET_PASSWORD_FRONTEND_PATH", "/reset-password/").lstrip("/")
        link = f"{base_url}/{path}?token={token}"

        EmailService.send_password_reset_email(
            user=user,
            link=link,
            token=token,
        )

    @staticmethod
    def reset_password(
        token: str,
        password: str,
        uid: str | None = None,
    ) -> None:
        payload, error = TokenService.decode_token(
            token,
            expected_purpose=RESET_PASSWORD_PURPOSE,
        )

        user = None
        if payload is not None:
            if not consume_reset_token(token):
                raise ValidationError({"token": "This link has already been used."})
            try:
                user = User.objects.get(id=payload["user_id"], email=payload["email"])
            except User.DoesNotExist:
                raise NotFound({"message": "User not found."})
        elif uid:
            try:
                user_id = force_str(urlsafe_base64_decode(uid))
                user = User.objects.get(pk=user_id)
            except (TypeError, ValueError, OverflowError, User.DoesNotExist):
                raise ValidationError({"uid": "Invalid reset link."})

            if not default_token_generator.check_token(user, token):
                raise ValidationError({"token": "Invalid or expired reset token."})
        else:
            raise AuthenticationFailed({"message": error or "Invalid reset token."})

        user.set_password(password)
        user.is_active = True
        user.save(update_fields=["password", "is_active", "updated_at"])

    @staticmethod
    def change_password(user, old_password: str, new_password: str) -> None:
        if not user.check_password(old_password):
            raise ValidationError({"old_password": "Current password is incorrect."})

        user.set_password(new_password)
        user.save(update_fields=["password", "updated_at"])
