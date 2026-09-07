from __future__ import annotations

import logging
from typing import Any

from celery import shared_task

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
    from volcanai.notification.services.email_service import EmailService

    return EmailService.send(
        to=to,
        subject=subject,
        body=body,
        template=template or None,
        context=context,
        from_email=from_email,
        reply_to=reply_to,
        fail_silently=False,
    )
