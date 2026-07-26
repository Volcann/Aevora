from django.urls import path

from volcanai.accounts.api.v1.views.forgot_password import forgot_password_view
from volcanai.accounts.api.v1.views.login import login_view
from volcanai.accounts.api.v1.views.logout import logout_view
from volcanai.accounts.api.v1.views.register import register_view
from volcanai.accounts.api.v1.views.reset_password import reset_password_view
from volcanai.accounts.api.v1.views.set_password import set_password_view

app_name = "accounts"

urlpatterns = [
    path("login/", login_view, name="login"),
    path("logout/", logout_view, name="logout"),
    path("forgot-password/", forgot_password_view, name="forgot_password"),
    path("reset-password/<uidb64>/<token>/", reset_password_view, name="reset_password"),
    path("set-password/", set_password_view, name="set_password"),
    path("register/", register_view, name="register"),
]
