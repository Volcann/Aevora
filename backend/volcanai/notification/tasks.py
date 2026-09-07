from __future__ import annotations

import logging
from typing import Any

from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMessage, EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags

logger = logging.getLogger(__name__)


@shared_task(
    name="notification.send_email",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_jitter=True,
    max_retries=3,
)
def send_email(
    _self,
    *,
    to: str | list[str],
    subject: str,
    template: str = "",
    context: dict[str, Any] | None = None,
    body: str = "",
    from_email: str | None = None,
    reply_to: list[str] | None = None,
) -> bool:
    recipients = [to] if isinstance(to, str) else list(to)
    sender = from_email or getattr(settings, "DEFAULT_FROM_EMAIL", settings.EMAIL_HOST_USER)
    merged_context = context or {}

    html_body = None
    text_body = body

    try:
        if template:
            html_body = render_to_string(template, merged_context)
            if not text_body:
                text_body = strip_tags(html_body)

        if html_body:
            message = EmailMultiAlternatives(
                subject=subject,
                body=text_body,
                from_email=sender,
                to=recipients,
                reply_to=reply_to or [],
            )
            message.attach_alternative(html_body, "text/html")
        else:
            message = EmailMessage(
                subject=subject,
                body=text_body,
                from_email=sender,
                to=recipients,
                reply_to=reply_to or [],
            )

        message.send(fail_silently=False)
        logger.info("Email '%s' sent successfully to %s", subject, recipients)
        return True

    except Exception:
        logger.exception("Failed to send email '%s' to %s", subject, recipients)
        raise
