import pytest
from django.urls import reverse
from rest_framework import status


@pytest.mark.django_db
class TestChangePassword:
    url = reverse("accounts:change_password")

    def test_change_password_succeeds(self, auth_client, user, raw_password):
        payload = {
            "old_password": raw_password,
            "new_password": "NewDifferentPass123!",
            "confirm_password": "NewDifferentPass123!",
        }
        response = auth_client.post(self.url, payload, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data == {"message": "Password changed successfully."}
        user.refresh_from_db()
        assert user.check_password("NewDifferentPass123!")

    def test_change_password_fails_with_incorrect_old_password(self, auth_client):
        payload = {
            "old_password": "IncorrectOldPassword!",
            "new_password": "NewDifferentPass123!",
            "confirm_password": "NewDifferentPass123!",
        }
        response = auth_client.post(self.url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_change_password_fails_when_new_matches_old(self, auth_client, raw_password):
        payload = {
            "old_password": raw_password,
            "new_password": raw_password,
            "confirm_password": raw_password,
        }
        response = auth_client.post(self.url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_change_password_fails_when_unauthenticated(self, api_client, raw_password):
        payload = {
            "old_password": raw_password,
            "new_password": "NewDifferentPass123!",
            "confirm_password": "NewDifferentPass123!",
        }
        response = api_client.post(self.url, payload, format="json")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_change_password_fails_when_passwords_mismatch(self, auth_client, raw_password):
        payload = {
            "old_password": raw_password,
            "new_password": "NewDifferentPass123!",
            "confirm_password": "MismatchingPass123!",
        }
        response = auth_client.post(self.url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_change_password_fails_with_empty_payload(self, auth_client):
        response = auth_client.post(self.url, {}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
