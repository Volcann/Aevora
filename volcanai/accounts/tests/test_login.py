import pytest
from django.urls import reverse
from rest_framework import status


@pytest.mark.django_db
class TestLogin:
    url = reverse("accounts:login")

    def test_login_returns_200_with_valid_credentials(self, api_client, user, valid_login_payload):
        response = api_client.post(self.url, valid_login_payload, format="json")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access" in data
        assert "refresh" in data
        assert "user" in data
        assert data["user"]["email"] == user.email
        assert data["user"]["username"] == user.username

    def test_login_normalizes_email_case_and_whitespace(
        self,
        api_client,
        user,
        raw_password,
    ):
        payload = {
            "email": f"  {user.email.upper()}  ",
            "password": raw_password,
        }
        response = api_client.post(self.url, payload, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.json()

    def test_login_returns_400_when_email_missing(self, api_client, raw_password):
        response = api_client.post(self.url, {"password": raw_password}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_returns_400_when_password_missing(self, api_client, user):
        response = api_client.post(self.url, {"email": user.email}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_returns_401_with_wrong_password(self, api_client, user):
        response = api_client.post(
            self.url,
            {"email": user.email, "password": "WrongPassword!"},
            format="json",
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_returns_401_for_unknown_email(self, api_client):
        response = api_client.post(
            self.url,
            {"email": "unknown@example.com", "password": "Password123!"},
            format="json",
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_returns_401_for_inactive_user(self, api_client, inactive_user, raw_password):
        response = api_client.post(
            self.url,
            {"email": inactive_user.email, "password": raw_password},
            format="json",
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_returns_405_for_get(self, api_client):
        response = api_client.get(self.url)

        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_login_returns_200_with_username(self, api_client, user, raw_password):
        response = api_client.post(
            self.url,
            {"username": user.username, "password": raw_password},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access" in data
        assert data["user"]["username"] == user.username

    def test_login_returns_200_with_username_whitespace(self, api_client, user, raw_password):
        response = api_client.post(
            self.url,
            {"username": f"  {user.username}  ", "password": raw_password},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.json()

    def test_login_returns_400_for_empty_payload(self, api_client):
        response = api_client.post(self.url, {}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_returns_400_for_empty_credentials(self, api_client):
        response = api_client.post(
            self.url,
            {"email": "", "password": ""},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
