import json

from django.db import DatabaseError
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

DEFAULT_THEME = {
    "theme": "dark",
    "primary_color": "#2da44e",
    "accent_color": "#58a6ff",
    "background_color": "#000000",
    "card_bg": "#161b22",
    "nav_bg": "#0d1117",
}


@require_http_methods(["GET", "POST", "PATCH"])
def theme_api(request):
    current = dict(DEFAULT_THEME)
    user = getattr(request, "user", None)
    if user and user.is_authenticated:
        user_config = getattr(user, "theme_config", None)
        if isinstance(user_config, dict):
            current.update(user_config)
    session_config = request.session.get("theme_config")
    if isinstance(session_config, dict):
        current.update(session_config)

    if request.method in ["POST", "PATCH"]:
        try:
            data = json.loads(request.body.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            data = request.POST.dict()

        allowed_keys = [
            "theme",
            "primary_color",
            "accent_color",
            "background_color",
            "card_bg",
            "nav_bg",
            "accent_h",
            "accent_s",
            "accent_l",
        ]
        for key in allowed_keys:
            if key in data:
                val = data[key]
                if isinstance(val, str):
                    current[key] = val.strip()
                elif isinstance(val, (int, float)):
                    current[key] = val

        request.session["theme_config"] = current
        request.session.modified = True

        if user and user.is_authenticated:
            try:
                user.theme_config = current
                user.save(update_fields=["theme_config"])
            except DatabaseError:
                pass

    return JsonResponse(current)
