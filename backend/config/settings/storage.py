from pathlib import Path

import environ

_BASE_DIR = Path(__file__).resolve().parent.parent.parent
env = environ.Env()
environ.Env.read_env(_BASE_DIR / ".env")

# Django 4.2+ requires STORAGES dict; DEFAULT_FILE_STORAGE was removed in Django 5.x
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}
