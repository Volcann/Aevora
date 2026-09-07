from __future__ import annotations

import logging
from typing import Any

from django.conf import settings

from volcanai.notification.tasks import send_email as send_email_task

logger = logging.getLogger(__name__)


class EmailService:
    @staticmethod
    def _sanitize_context(context: dict[str, Any]) -> dict[str, Any]:
        safe_context: dict[str, Any] = {}
        for key, value in context.items():
            if hasattr(value, "_meta"):
                safe_context[key] = {
                    "id": getattr(value, "pk", None),
                    "username": getattr(value, "username", ""),
                    "email": getattr(value, "email", ""),
                    "first_name": getattr(value, "first_name", ""),
                    "last_name": getattr(value, "last_name", ""),
                }
            else:
                safe_context[key] = value
        return safe_context

    @classmethod
    def send_email(
        cls,
        *,
        to: str | list[str],
        subject: str,
        body: str = "",
        template: str | None = None,
        context: dict[str, Any] | None = None,
        from_email: str | None = None,
        reply_to: list[str] | None = None,
    ) -> None:
        safe_context = cls._sanitize_context(context or {})
        send_email_task.delay(
            to=to,
            subject=subject,
            template=template or "",
            context=safe_context,
            body=body,
            from_email=from_email,
            reply_to=reply_to,
        )

    @classmethod
    def send_welcome_email(
        cls,
        *,
        user,
        app_url: str | None = None,
        protocol: str = "http",
        domain: str = "localhost",
    ) -> None:
        url = app_url or getattr(settings, "APP_BASE_URL", None) or "http://localhost:3000"
        context = {
            "user": user,
            "protocol": protocol,
            "domain": domain,
            "app_url": url,
        }
        cls.send_email(
            to=user.email,
            subject="Welcome to Volcann! 🎉",
            template="emails/sign_up.html",
            context=context,
        )

    @classmethod
    def send_password_reset_email(
        cls,
        *,
        user,
        link: str | None = None,
        uid: str | None = None,
        token: str | None = None,
        protocol: str = "http",
        domain: str = "localhost",
    ) -> None:
        if link:
            reset_url = link
        else:
            base_url = (getattr(settings, "APP_BASE_URL", None) or "http://localhost:3000").rstrip(
                "/"
            )
            reset_path = getattr(
                settings,
                "RESET_PASSWORD_FRONTEND_PATH",
                "/reset-password/",
            ).lstrip("/")
            reset_url = f"{base_url}/{reset_path}?token={token}"
            if uid:
                reset_url += f"&uid={uid}"

        context = {
            "user": user,
            "uid": uid or "",
            "token": token or "",
            "protocol": protocol,
            "domain": domain,
            "reset_url": reset_url,
        }

        cls.send_email(
            to=user.email,
            subject="Reset your Volcann password 🔒",
            template="emails/reset_password.html",
            context=context,
        )
