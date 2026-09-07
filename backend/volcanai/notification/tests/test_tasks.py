import pytest
from celery.exceptions import Retry
from django.core import mail

from volcanai.notification.tasks import send_email


@pytest.mark.django_db
class TestNotificationTasks:
    def test_send_email_task(self):
        async_result = send_email.apply(
            kwargs={
                "to": "task@example.com",
                "subject": "Task Subject",
                "template": "emails/sign_up.html",
                "context": {
                    "user": {"username": "taskuser"},
                    "app_url": "http://localhost:3000",
                },
            },
        )

        assert async_result.get() is True
        assert len(mail.outbox) == 1
        assert mail.outbox[0].subject == "Task Subject"

    def test_send_password_reset_email_task(self):
        async_result = send_email.apply(
            kwargs={
                "to": "reset_task@example.com",
                "subject": "Reset Task",
                "template": "emails/reset_password.html",
                "context": {
                    "user": {"username": "taskuser"},
                    "reset_url": "http://localhost:3000/reset",
                },
            },
        )

        assert async_result.get() is True
        assert len(mail.outbox) == 1
        assert mail.outbox[0].subject == "Reset Task"

    def test_send_email_task_with_plain_body(self):
        async_result = send_email.apply(
            kwargs={
                "to": "plain_task@example.com",
                "subject": "Plain Task Subject",
                "body": "Plain Task Content",
            },
        )

        assert async_result.get() is True
        assert len(mail.outbox) == 1
        assert mail.outbox[0].body == "Plain Task Content"

    def test_send_email_task_handles_error(self, monkeypatch):
        def failing_send(*_args, **_kwargs):
            raise ConnectionError("Mail server unavailable")

        monkeypatch.setattr(
            "django.core.mail.EmailMessage.send",
            failing_send,
        )

        with pytest.raises(Retry):
            send_email.apply(
                kwargs={
                    "to": "fail_task@example.com",
                    "subject": "Fail Task",
                    "body": "Fail Content",
                },
            )
