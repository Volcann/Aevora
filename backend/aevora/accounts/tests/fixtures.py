import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from aevora.accounts.services.tokens import (
    ONBOARDING_PURPOSE,
    RESET_PASSWORD_PURPOSE,
    TokenService,
)

User = get_user_model()


@pytest.fixture
def raw_password():
    return "Password123!"


@pytest.fixture
def user(raw_password):
    return User.objects.create_user(
        username="testuser",
        email="testuser@example.com",
        password=raw_password,
        first_name="Test",
        last_name="User",
    )


@pytest.fixture
def inactive_user(raw_password):
    return User.objects.create_user(
        username="inactiveuser",
        email="inactive@example.com",
        password=raw_password,
        is_active=False,
    )


@pytest.fixture
def onboarding_user(raw_password):
    return User.objects.create_user(
        username="inviteduser",
        email="invited@example.com",
        password=raw_password,
        is_active=False,
    )


@pytest.fixture
def auth_client(user):
    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return client


@pytest.fixture
def valid_login_payload(user, raw_password):
    return {
        "email": user.email,
        "password": raw_password,
    }


@pytest.fixture
def onboarding_token(onboarding_user):
    return TokenService.generate_token(onboarding_user, purpose=ONBOARDING_PURPOSE)


@pytest.fixture
def reset_password_token(user):
    return TokenService.generate_token(user, purpose=RESET_PASSWORD_PURPOSE)
