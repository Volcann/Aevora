import json

from django.core.exceptions import ObjectDoesNotExist

DEFAULT_THEME_CONFIG = {
    "theme": "dark",
    "primary_color": "#2da44e",
    "accent_color": "#58a6ff",
    "background_color": "#000000",
    "card_bg": "#161b22",
    "nav_bg": "#0d1117",
    "accent_h": 138,
    "accent_s": 55,
    "accent_l": 42,
}


def theme_context(request):
    config = dict(DEFAULT_THEME_CONFIG)
    session_config = request.session.get("theme_config")
    if isinstance(session_config, dict):
        config.update(session_config)
    user = getattr(request, "user", None)
    if user and user.is_authenticated:
        try:
            user_config = getattr(user, "theme_config", None)
            if isinstance(user_config, dict):
                config.update(user_config)
        except ObjectDoesNotExist:
            pass
    return {
        "user_theme_config": config,
        "user_theme_json": json.dumps(config),
    }
