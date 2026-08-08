import pytest
from django.core import mail
from django.urls import reverse
from rest_framework import status


@pytest.mark.django_db
class TestForgotPassword:
    url = reverse("accounts:forgot_password")

    def test_forgot_password_sends_email_for_registered_user(self, api_client, user):
        response = api_client.post(self.url, {"email": user.email}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data == {
            "message": "If this email is registered, a password reset link has been sent."
        }
        assert len(mail.outbox) == 1
        assert "Reset your Volcann password" in mail.outbox[0].subject
        assert "token=" in mail.outbox[0].body

    def test_forgot_password_succeeds_silently_for_unregistered_email(self, api_client):
        response = api_client.post(self.url, {"email": "notfound@example.com"}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data == {
            "message": "If this email is registered, a password reset link has been sent."
        }
        assert len(mail.outbox) == 0

    def test_forgot_password_returns_400_for_invalid_email(self, api_client):
        response = api_client.post(self.url, {"email": "invalid-email"}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_forgot_password_normalizes_uppercase_email(self, api_client, user):
        response = api_client.post(self.url, {"email": user.email.upper()}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert len(mail.outbox) == 1

    def test_forgot_password_returns_400_when_email_missing(self, api_client):
        response = api_client.post(self.url, {}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
