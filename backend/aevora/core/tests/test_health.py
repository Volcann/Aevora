import pytest
from django.urls import reverse
from rest_framework import status


@pytest.mark.django_db
def test_health_check(client):
    url = reverse("health-check")
    response = client.get(url)

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"status": "ok"}
