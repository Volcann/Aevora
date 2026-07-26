from django.urls import path

from volcanai.dashboard import views

app_name = "dashboard"

urlpatterns = [
    path("", views.index, name="index"),
]
