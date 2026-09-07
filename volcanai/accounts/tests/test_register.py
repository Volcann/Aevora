import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from django.urls import reverse
from rest_framework import status

User = get_user_model()


@pytest.mark.django_db
class TestRegister:
    url = reverse("accounts:register")

    def test_register_returns_201_with_valid_payload(self, api_client):
        payload = {
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "SecurePassword123!",
            "confirm_password": "SecurePassword123!",
            "first_name": "New",
            "last_name": "User",
        }
        response = api_client.post(self.url, payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert "tokens" in data
        assert "access" in data["tokens"]
        assert "refresh" in data["tokens"]
        assert "user" in data
        assert data["user"]["email"] == "newuser@example.com"
        assert User.objects.filter(email="newuser@example.com").exists()
        assert len(mail.outbox) == 1
        assert "Welcome to Volcann!" in mail.outbox[0].subject

    def test_register_returns_400_when_passwords_do_not_match(self, api_client):
        payload = {
            "username": "mismatchuser",
            "email": "mismatch@example.com",
            "password": "SecurePassword123!",
            "confirm_password": "DifferentPassword123!",
        }
        response = api_client.post(self.url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_returns_400_on_duplicate_email(self, api_client, user):
        payload = {
            "username": "distinctuser",
            "email": user.email,
            "password": "SecurePassword123!",
            "confirm_password": "SecurePassword123!",
        }
        response = api_client.post(self.url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_returns_400_on_duplicate_username(self, api_client, user):
        payload = {
            "username": user.username,
            "email": "distinct@example.com",
            "password": "SecurePassword123!",
            "confirm_password": "SecurePassword123!",
        }
        response = api_client.post(self.url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_returns_400_when_password_too_short(self, api_client):
        payload = {
            "username": "shortpassuser",
            "email": "shortpass@example.com",
            "password": "short",
            "confirm_password": "short",
        }
        response = api_client.post(self.url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_returns_400_with_empty_payload(self, api_client):
        response = api_client.post(self.url, {}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_normalizes_email_case(self, api_client):
        payload = {
            "username": "casenormuser",
            "email": "CaseNorm@Example.COM",
            "password": "SecurePassword123!",
            "confirm_password": "SecurePassword123!",
        }
        response = api_client.post(self.url, payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        created_user = User.objects.get(username="casenormuser")
        assert created_user.email == "casenorm@example.com"
