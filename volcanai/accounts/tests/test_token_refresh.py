import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken


@pytest.mark.django_db
class TestTokenRefresh:
    url = reverse("accounts:token_refresh")

    def test_token_refresh_returns_200_with_valid_token(self, api_client, user):
        refresh = RefreshToken.for_user(user)
        response = api_client.post(self.url, {"refresh": str(refresh)}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.json()

    def test_token_refresh_returns_401_with_invalid_token(self, api_client):
        response = api_client.post(self.url, {"refresh": "invalid.token.here"}, format="json")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_token_refresh_returns_400_when_missing_token(self, api_client):
        response = api_client.post(self.url, {}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_token_refresh_returns_400_with_empty_string(self, api_client):
        response = api_client.post(self.url, {"refresh": ""}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_token_refresh_returns_405_for_get(self, api_client):
        response = api_client.get(self.url)

        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
