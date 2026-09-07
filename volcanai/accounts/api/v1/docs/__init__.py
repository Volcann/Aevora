from volcanai.accounts.api.v1.docs.change_password import change_password_schema
from volcanai.accounts.api.v1.docs.forgot_password import forgot_password_schema
from volcanai.accounts.api.v1.docs.login import login_schema
from volcanai.accounts.api.v1.docs.logout import logout_schema
from volcanai.accounts.api.v1.docs.me import me_get_schema, me_patch_schema
from volcanai.accounts.api.v1.docs.register import register_schema
from volcanai.accounts.api.v1.docs.reset_password import reset_password_schema
from volcanai.accounts.api.v1.docs.set_password import set_initial_password_schema
from volcanai.accounts.api.v1.docs.token_refresh import token_refresh_schema

__all__ = [
    "change_password_schema",
    "forgot_password_schema",
    "login_schema",
    "logout_schema",
    "me_get_schema",
    "me_patch_schema",
    "register_schema",
    "reset_password_schema",
    "set_initial_password_schema",
    "token_refresh_schema",
]
