import pytest
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed

from volcanai.accounts.api.v1.serializers.change_password import ChangePasswordSerializer
from volcanai.accounts.api.v1.serializers.forgot_password import ForgotPasswordSerializer
from volcanai.accounts.api.v1.serializers.login import LoginSerializer
from volcanai.accounts.api.v1.serializers.logout import LogoutSerializer
from volcanai.accounts.api.v1.serializers.me import UserMeSerializer
from volcanai.accounts.api.v1.serializers.register import RegisterSerializer
from volcanai.accounts.api.v1.serializers.reset_password import ResetPasswordSerializer
from volcanai.accounts.api.v1.serializers.set_password import SetInitialPasswordSerializer


@pytest.mark.django_db
class TestAccountSerializers:
    def test_login_serializer_with_email(self, user, raw_password):
        serializer = LoginSerializer(data={"email": user.email, "password": raw_password})
        assert serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        assert "access" in data
        assert "refresh" in data
        assert data["user"]["email"] == user.email

    def test_login_serializer_with_username(self, user, raw_password):
        serializer = LoginSerializer(data={"username": user.username, "password": raw_password})
        assert serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        assert "access" in data
        assert data["user"]["username"] == user.username

    def test_login_serializer_with_whitespace_and_mixed_case(self, user, raw_password):
        serializer = LoginSerializer(
            data={"email": f"  {user.email.upper()}  ", "password": raw_password}
        )
        assert serializer.is_valid(raise_exception=True)

    def test_login_serializer_missing_identifier(self, raw_password):
        serializer = LoginSerializer(data={"password": raw_password})
        with pytest.raises(serializers.ValidationError):
            serializer.is_valid(raise_exception=True)

    def test_login_serializer_inactive_user(self, inactive_user, raw_password):
        serializer = LoginSerializer(data={"email": inactive_user.email, "password": raw_password})
        with pytest.raises(AuthenticationFailed):
            serializer.is_valid(raise_exception=True)

    def test_user_me_serializer_read_only_fields_ignored_on_update(self, user):
        serializer = UserMeSerializer(
            instance=user,
            data={
                "email": "hacked@example.com",
                "username": "hackeduser",
                "first_name": "NewFirst",
                "theme_config": {"palette": "slate"},
            },
            partial=True,
        )
        assert serializer.is_valid(raise_exception=True)
        updated_user = serializer.save()

        assert updated_user.email == "testuser@example.com"
        assert updated_user.username == "testuser"
        assert updated_user.first_name == "NewFirst"
        assert updated_user.theme_config == {"palette": "slate"}

    def test_register_serializer_validation(self, user):
        mismatch_serializer = RegisterSerializer(
            data={
                "username": "unique1",
                "email": "unique1@example.com",
                "password": "Password123!",
                "confirm_password": "WrongPassword123!",
            }
        )
        assert not mismatch_serializer.is_valid()
        assert "confirm_password" in mismatch_serializer.errors

        duplicate_email_serializer = RegisterSerializer(
            data={
                "username": "unique2",
                "email": user.email,
                "password": "Password123!",
                "confirm_password": "Password123!",
            }
        )
        assert not duplicate_email_serializer.is_valid()
        assert "email" in duplicate_email_serializer.errors

    def test_forgot_password_serializer_validation(self):
        valid = ForgotPasswordSerializer(data={"email": "valid@example.com"})
        assert valid.is_valid()

        invalid = ForgotPasswordSerializer(data={"email": "not-an-email"})
        assert not invalid.is_valid()
        assert "email" in invalid.errors

    def test_reset_password_serializer_validation(self, reset_password_token):
        mismatch = ResetPasswordSerializer(
            data={
                "token": reset_password_token,
                "password": "Password123!",
                "confirm_password": "Mismatch123!",
            }
        )
        assert not mismatch.is_valid()
        assert "confirm_password" in mismatch.errors

    def test_set_initial_password_serializer_validation(self, onboarding_token):
        mismatch = SetInitialPasswordSerializer(
            data={
                "token": onboarding_token,
                "password": "Password123!",
                "confirm_password": "Mismatch123!",
            }
        )
        assert not mismatch.is_valid()
        assert "confirm_password" in mismatch.errors

        invalid_token = SetInitialPasswordSerializer(
            data={
                "token": "invalid-token",
                "password": "Password123!",
                "confirm_password": "Password123!",
            }
        )
        assert not invalid_token.is_valid()
        assert "token" in invalid_token.errors

    def test_change_password_serializer_validation(self, user, raw_password):
        context = {"request": type("Request", (), {"user": user})()}

        mismatched_new = ChangePasswordSerializer(
            data={
                "old_password": raw_password,
                "new_password": "NewDifferentPassword123!",
                "confirm_password": "MismatchingPassword123!",
            },
            context=context,
        )
        assert not mismatched_new.is_valid()
        assert "confirm_password" in mismatched_new.errors

        same_password = ChangePasswordSerializer(
            data={
                "old_password": raw_password,
                "new_password": raw_password,
                "confirm_password": raw_password,
            },
            context=context,
        )
        assert not same_password.is_valid()
        assert "new_password" in same_password.errors

        valid = ChangePasswordSerializer(
            data={
                "old_password": raw_password,
                "new_password": "NewDifferentPassword123!",
                "confirm_password": "NewDifferentPassword123!",
            },
            context=context,
        )
        assert valid.is_valid()

    def test_logout_serializer_validation(self):
        valid = LogoutSerializer(data={"refresh": "valid-token-string"})
        assert valid.is_valid()

        missing = LogoutSerializer(data={})
        assert not missing.is_valid()
        assert "refresh" in missing.errors
