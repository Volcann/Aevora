import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.exceptions import AuthenticationFailed, NotFound, ValidationError

from aevora.accounts.services.password import PasswordService
from aevora.accounts.services.redis_token_store import store_reset_token

User = get_user_model()


@pytest.mark.django_db
class TestPasswordService:
    def test_forgot_password_sends_email_and_stores_token(self, user):
        result = PasswordService.forgot_password(user=user)

        assert result is None
        assert len(mail.outbox) == 1
        assert "Reset your Volcann password" in mail.outbox[0].subject

    def test_forgot_password_uses_default_app_base_url_when_none(self, user, settings):
        settings.APP_BASE_URL = None
        result = PasswordService.forgot_password(user=user)

        assert result is None
        assert len(mail.outbox) == 1
        assert "http://localhost:3000" in mail.outbox[0].body

    def test_forgot_password_uses_configured_app_base_url(self, user, settings):
        settings.APP_BASE_URL = "https://custom.domain.com"
        result = PasswordService.forgot_password(user=user)

        assert result is None
        assert len(mail.outbox) == 1
        assert "https://custom.domain.com" in mail.outbox[0].body

    def test_reset_password_with_valid_jwt_token(self, user, reset_password_token):
        store_reset_token(reset_password_token, 3600)
        result = PasswordService.reset_password(
            token=reset_password_token,
            password="NewPassword123!",
        )

        assert result is None
        user.refresh_from_db()
        assert user.check_password("NewPassword123!")

    def test_reset_password_fails_when_token_is_replayed(self, user, reset_password_token):
        store_reset_token(reset_password_token, 3600)
        PasswordService.reset_password(token=reset_password_token, password="FirstPass123!")

        with pytest.raises(ValidationError):
            PasswordService.reset_password(token=reset_password_token, password="SecondPass123!")

    def test_reset_password_raises_not_found_when_user_does_not_exist(
        self,
        reset_password_token,
        user,
    ):
        store_reset_token(reset_password_token, 3600)
        user.delete()

        with pytest.raises(NotFound):
            PasswordService.reset_password(
                token=reset_password_token,
                password="NewPassword123!",
            )

    def test_reset_password_legacy_uid_and_token(self, user):
        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))

        result = PasswordService.reset_password(
            token=token,
            password="LegacyPassword123!",
            uid=uid,
        )

        assert result is None
        user.refresh_from_db()
        assert user.check_password("LegacyPassword123!")

    def test_reset_password_legacy_fails_with_invalid_uid(self, user):
        token = default_token_generator.make_token(user)

        with pytest.raises(ValidationError):
            PasswordService.reset_password(
                token=token,
                password="LegacyPassword123!",
                uid="invalid-base64-uid",
            )

    def test_reset_password_legacy_fails_with_invalid_token(self, user):
        uid = urlsafe_base64_encode(force_bytes(user.pk))

        with pytest.raises(ValidationError):
            PasswordService.reset_password(
                token="invalid-token-string",
                password="LegacyPassword123!",
                uid=uid,
            )

    def test_reset_password_raises_authentication_failed_for_garbage_token(self):
        with pytest.raises(AuthenticationFailed):
            PasswordService.reset_password(
                token="unparseable.garbage.token",
                password="NewPassword123!",
            )

    def test_change_password_succeeds(self, user, raw_password):
        result = PasswordService.change_password(
            user=user,
            old_password=raw_password,
            new_password="ChangedPassword123!",
        )

        assert result is None
        user.refresh_from_db()
        assert user.check_password("ChangedPassword123!")

    def test_change_password_fails_with_invalid_old_password(self, user):
        with pytest.raises(ValidationError):
            PasswordService.change_password(
                user=user,
                old_password="IncorrectPassword!",
                new_password="ChangedPassword123!",
            )
