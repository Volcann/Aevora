import dj_database_url

from .base import *

ALLOWED_HOSTS = ["*"]
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:8002",
]

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

DATABASES = {
    "default": dj_database_url.parse(
        env(
            "DATABASE_URL",
            default="postgres://postgres:postgres@postgres:5432/postgres",
        ),
    ),
}

# Console backend unless EMAIL_BACKEND is set in .env
EMAIL_BACKEND = env(
    "EMAIL_BACKEND",
    default="django.core.mail.backends.console.EmailBackend",
)

INSTALLED_APPS += ["silk"]

MIDDLEWARE.insert(0, "silk.middleware.SilkyMiddleware")

SILKY_INTERCEPT_PERCENT = 100
SILKY_MAX_REQUEST_BODY_SIZE = -1
SILKY_MAX_RESPONSE_BODY_SIZE = -1
SILKY_IGNORE_PATHS = ["/admin/"]
