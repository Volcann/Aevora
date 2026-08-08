import pytest
from django.urls import reverse
from rest_framework import status


@pytest.mark.django_db
class TestMe:
    url = reverse("accounts:me")

    def test_me_returns_200_when_authenticated(self, auth_client, user):
        response = auth_client.get(self.url)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["email"] == user.email
        assert data["username"] == user.username

    def test_me_returns_401_when_unauthenticated(self, api_client):
        response = api_client.get(self.url)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_me_updates_theme_config_via_patch(self, auth_client, user):
        payload = {"theme_config": {"theme": "dark", "accent_color": "#ff0000"}}
        response = auth_client.patch(self.url, payload, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["theme_config"]["theme"] == "dark"

        user.refresh_from_db()
        assert user.theme_config["accent_color"] == "#ff0000"

    def test_me_updates_name_via_patch(self, auth_client, user):
        payload = {"first_name": "UpdatedFirst", "last_name": "UpdatedLast"}
        response = auth_client.patch(self.url, payload, format="json")

        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.first_name == "UpdatedFirst"
        assert user.last_name == "UpdatedLast"

    def test_me_patch_does_not_mutate_read_only_fields(self, auth_client, user):
        payload = {"email": "mutated@example.com", "username": "mutateduser"}
        response = auth_client.patch(self.url, payload, format="json")

        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.email == "testuser@example.com"
        assert user.username == "testuser"

    def test_me_patch_returns_401_when_unauthenticated(self, api_client):
        response = api_client.patch(self.url, {"first_name": "Unauth"}, format="json")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
