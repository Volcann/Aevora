from django.urls import path

from aevora.core.api.v1.views import (
    health_check,
)

urlpatterns = [
    path("health/", health_check, name="health-check"),
]
