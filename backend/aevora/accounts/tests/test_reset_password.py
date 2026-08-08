import pytest
from django.contrib.auth.tokens import default_token_generator
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status

from aevora.accounts.services.redis_token_store import store_reset_token


@pytest.mark.django_db
class TestResetPassword:
    url = reverse("accounts:reset_password")

    def test_reset_password_succeeds_with_valid_jwt_token(
        self,
        api_client,
        user,
        reset_password_token,
    ):
        store_reset_token(reset_password_token, 3600)
        payload = {
            "token": reset_password_token,
            "password": "BrandNewPassword123!",
            "confirm_password": "BrandNewPassword123!",
        }
        response = api_client.post(self.url, payload, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data == {
            "message": "Password reset successfully. You can now sign in with your new password."
        }
        user.refresh_from_db()
        assert user.check_password("BrandNewPassword123!")

    def test_reset_password_token_replay_fails(
        self,
        api_client,
        user,
        reset_password_token,
    ):
        store_reset_token(reset_password_token, 3600)
        payload = {
            "token": reset_password_token,
            "password": "BrandNewPassword123!",
            "confirm_password": "BrandNewPassword123!",
        }
        first_resp = api_client.post(self.url, payload, format="json")
        assert first_resp.status_code == status.HTTP_200_OK

        second_resp = api_client.post(self.url, payload, format="json")
        assert second_resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_reset_password_fails_on_password_mismatch(
        self,
        api_client,
        reset_password_token,
    ):
        payload = {
            "token": reset_password_token,
            "password": "BrandNewPassword123!",
            "confirm_password": "DifferentPassword123!",
        }
        response = api_client.post(self.url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_reset_password_fails_on_corrupted_token(self, api_client):
        payload = {
            "token": "corrupted.token.value",
            "password": "BrandNewPassword123!",
            "confirm_password": "BrandNewPassword123!",
        }
        response = api_client.post(self.url, payload, format="json")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_reset_password_supports_legacy_uid_format(self, api_client, user):
        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))

        payload = {
            "uid": uid,
            "token": token,
            "password": "LegacyPassword123!",
            "confirm_password": "LegacyPassword123!",
        }
        response = api_client.post(self.url, payload, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data == {
            "message": "Password reset successfully. You can now sign in with your new password."
        }
        user.refresh_from_db()
        assert user.check_password("LegacyPassword123!")

    def test_reset_password_fails_when_password_missing(self, api_client, reset_password_token):
        payload = {"token": reset_password_token}
        response = api_client.post(self.url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_reset_password_fails_when_token_missing(self, api_client):
        payload = {
            "password": "NewPassword123!",
            "confirm_password": "NewPassword123!",
        }
        response = api_client.post(self.url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_reset_password_fails_with_invalid_legacy_uid(self, api_client):
        payload = {
            "uid": "invalid-uid-format",
            "token": "some-token",
            "password": "NewPassword123!",
            "confirm_password": "NewPassword123!",
        }
        response = api_client.post(self.url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
