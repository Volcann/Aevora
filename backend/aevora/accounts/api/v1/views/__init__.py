from aevora.accounts.api.v1.views.change_password import ChangePasswordView
from aevora.accounts.api.v1.views.forgot_password import ForgotPasswordView
from aevora.accounts.api.v1.views.login import LoginView
from aevora.accounts.api.v1.views.logout import LogoutView
from aevora.accounts.api.v1.views.me import MeView
from aevora.accounts.api.v1.views.register import RegisterView
from aevora.accounts.api.v1.views.reset_password import ResetPasswordView
from aevora.accounts.api.v1.views.set_password import SetInitialPasswordView

__all__ = [
    "ChangePasswordView",
    "ForgotPasswordView",
    "LoginView",
    "LogoutView",
    "MeView",
    "RegisterView",
    "ResetPasswordView",
    "SetInitialPasswordView",
]
