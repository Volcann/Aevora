import pytest
from rest_framework.test import APIClient

from aevora.accounts.tests.fixtures import *


@pytest.fixture(autouse=True)
def test_environment(settings):
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    settings.CELERY_TASK_ALWAYS_EAGER = True
    settings.CELERY_TASK_EAGER_PROPAGATES = True
    settings.DEFAULT_FROM_EMAIL = "no-reply@volcann.ai"


@pytest.fixture
def api_client():
    return APIClient()
