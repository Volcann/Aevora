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
            default="postgres://postgres:postgres@postgres:5434/postgres",
        ),
    ),
}

if "silk" not in INSTALLED_APPS:
    INSTALLED_APPS = INSTALLED_APPS + ["silk"]

if "silk.middleware.SilkyMiddleware" not in MIDDLEWARE:
    MIDDLEWARE = ["silk.middleware.SilkyMiddleware"] + MIDDLEWARE

SILKY_INTERCEPT_PERCENT = 100
SILKY_MAX_REQUEST_BODY_SIZE = -1
SILKY_MAX_RESPONSE_BODY_SIZE = -1
SILKY_IGNORE_PATHS = ["/admin/"]
