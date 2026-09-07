from django.urls import path

from volcanai.accounts.api.v1.views import (
    ChangePasswordView,
    CustomTokenRefreshView,
    ForgotPasswordView,
    LoginView,
    LogoutView,
    MeView,
    RegisterView,
    ResetPasswordView,
    SetInitialPasswordView,
)

app_name = "accounts"

urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    path("token/refresh/", CustomTokenRefreshView.as_view(), name="token_refresh"),
    path("register/", RegisterView.as_view(), name="register"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", MeView.as_view(), name="me"),
    path("forgot-password/", ForgotPasswordView.as_view(), name="forgot_password"),
    path("reset-password/", ResetPasswordView.as_view(), name="reset_password"),
    path("set-password/", SetInitialPasswordView.as_view(), name="set_password"),
    path("change-password/", ChangePasswordView.as_view(), name="change_password"),
]
