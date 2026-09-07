import pytest


@pytest.fixture(autouse=True)
def notification_test_environment(settings):
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    settings.CELERY_TASK_ALWAYS_EAGER = True
    settings.CELERY_TASK_EAGER_PROPAGATES = True
    settings.DEFAULT_FROM_EMAIL = "no-reply@volcann.ai"
