from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
environ.Env.read_env(BASE_DIR / ".env")

EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = "smtp.gmail.com"
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = env("SENDER_EMAIL", default="")
EMAIL_HOST_PASSWORD = env("APP_PASSWORD", default="")
DEFAULT_FROM_EMAIL = env("SENDER_EMAIL", default="")
RECEIVER_EMAIL = env("RECEIVER_EMAIL", default="")
