import pytest
from django.urls import reverse
from rest_framework import status


@pytest.mark.django_db
class TestSetPassword:
    url = reverse("accounts:set_password")

    def test_set_password_activates_user_and_returns_tokens(
        self,
        api_client,
        onboarding_user,
        onboarding_token,
    ):
        payload = {
            "token": onboarding_token,
            "password": "ActivatedPassword123!",
            "confirm_password": "ActivatedPassword123!",
        }
        response = api_client.post(self.url, payload, format="json")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access" in data
        assert "refresh" in data

        onboarding_user.refresh_from_db()
        assert onboarding_user.is_active is True
        assert onboarding_user.check_password("ActivatedPassword123!")

    def test_set_password_fails_on_password_mismatch(
        self,
        api_client,
        onboarding_token,
    ):
        payload = {
            "token": onboarding_token,
            "password": "ActivatedPassword123!",
            "confirm_password": "WrongPassword123!",
        }
        response = api_client.post(self.url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_set_password_fails_on_invalid_token(self, api_client):
        payload = {
            "token": "invalid.onboarding.token",
            "password": "ActivatedPassword123!",
            "confirm_password": "ActivatedPassword123!",
        }
        response = api_client.post(self.url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_set_password_fails_when_token_missing(self, api_client):
        payload = {
            "password": "ActivatedPassword123!",
            "confirm_password": "ActivatedPassword123!",
        }
        response = api_client.post(self.url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_set_password_fails_when_password_too_short(self, api_client, onboarding_token):
        payload = {
            "token": onboarding_token,
            "password": "short",
            "confirm_password": "short",
        }
        response = api_client.post(self.url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
