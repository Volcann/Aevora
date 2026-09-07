import pytest
from django.contrib.auth import get_user_model
from django.core import mail

from volcanai.notification.services.email_service import EmailService

User = get_user_model()


@pytest.mark.django_db
class TestEmailService:
    def test_send_html_template_email(self):
        EmailService.send_email(
            to="test@example.com",
            subject="Welcome Aboard",
            template="emails/sign_up.html",
            context={"user": {"username": "tester"}, "app_url": "http://localhost:3000"},
        )

        assert len(mail.outbox) == 1
        assert mail.outbox[0].subject == "Welcome Aboard"
        assert "test@example.com" in mail.outbox[0].to

    def test_send_plain_text_email(self):
        EmailService.send_email(
            to="plain@example.com",
            subject="Plain Text Subject",
            body="This is a simple plain text body.",
        )

        assert len(mail.outbox) == 1
        assert mail.outbox[0].body == "This is a simple plain text body."

    def test_send_welcome_email(self):
        user = User.objects.create_user(
            username="welcomeuser",
            email="welcome@example.com",
            password="Password123!",
        )
        EmailService.send_welcome_email(user=user)

        assert len(mail.outbox) == 1
        assert "Welcome to Volcann!" in mail.outbox[0].subject

    def test_send_password_reset_email(self):
        user = User.objects.create_user(
            username="resetuser",
            email="reset@example.com",
            password="Password123!",
        )
        EmailService.send_password_reset_email(user=user, token="sample-token")

        assert len(mail.outbox) == 1
        assert "Reset your Volcann password" in mail.outbox[0].subject
        assert "sample-token" in mail.outbox[0].body

    def test_sanitize_context_extracts_model_fields(self):
        user = User(
            username="sanitize_user",
            email="sanitize@example.com",
            first_name="Sanitize",
            last_name="Test",
        )
        context = {"user": user, "extra_info": "unaffected"}
        sanitized = EmailService._sanitize_context(context)

        assert isinstance(sanitized["user"], dict)
        assert sanitized["user"]["username"] == "sanitize_user"
        assert sanitized["user"]["email"] == "sanitize@example.com"
        assert sanitized["extra_info"] == "unaffected"

    def test_send_to_multiple_recipients(self):
        recipients = ["one@example.com", "two@example.com"]
        EmailService.send_email(
            to=recipients,
            subject="Multi-recipient Test",
            body="Content",
        )

        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == recipients

    def test_send_with_custom_from_and_reply_to(self):
        EmailService.send_email(
            to="reply_target@example.com",
            subject="Reply-To Test",
            body="Content",
            from_email="custom_sender@example.com",
            reply_to=["replies@example.com"],
        )

        assert len(mail.outbox) == 1
        assert mail.outbox[0].from_email == "custom_sender@example.com"
        assert mail.outbox[0].reply_to == ["replies@example.com"]

    def test_send_password_reset_email_constructs_url_with_uid(self):
        user = User.objects.create_user(
            username="uiduser",
            email="uiduser@example.com",
            password="Password123!",
        )
        EmailService.send_password_reset_email(
            user=user,
            token="test-token",
            uid="encoded-uid",
        )

        assert len(mail.outbox) == 1
        assert "uid=encoded-uid" in mail.outbox[0].body
