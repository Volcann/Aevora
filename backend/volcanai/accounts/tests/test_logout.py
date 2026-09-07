import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken


@pytest.mark.django_db
class TestLogout:
    url = reverse("accounts:logout")

    def test_logout_returns_200_when_authenticated(self, auth_client, user):
        refresh = RefreshToken.for_user(user)
        response = auth_client.post(self.url, {"refresh": str(refresh)}, format="json")

        assert response.status_code == status.HTTP_200_OK

    def test_logout_returns_401_when_unauthenticated(self, api_client):
        response = api_client.post(self.url, {}, format="json")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_logout_handles_malformed_refresh_token_gracefully(self, auth_client):
        response = auth_client.post(self.url, {"refresh": "malformed.refresh.token"}, format="json")

        assert response.status_code == status.HTTP_200_OK

    def test_logout_handles_missing_refresh_payload_gracefully(self, auth_client):
        response = auth_client.post(self.url, {}, format="json")

        assert response.status_code == status.HTTP_200_OK
