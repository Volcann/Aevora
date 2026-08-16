from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase
from django.urls import reverse

from volcanai.accounts.services.email import EmailService

User = get_user_model()


class PasswordResetEmailTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            email="testuser@example.com",
            password="Password123!",
        )

    def test_send_password_reset_email_renders_correct_url(self):
        EmailService.send_password_reset_email(
            user=self.user,
            uid="MQ",
            token="test-token",
            protocol="http",
            domain="localhost:8000",
        )
        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        expected_url = reverse("accounts:reset_password", kwargs={"uidb64": "MQ", "token": "test-token"})
        self.assertIn(expected_url, email.body)

    def test_forgot_password_view_post(self):
        response = self.client.post(
            reverse("accounts:forgot_password"),
            {"email": "testuser@example.com"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)

    def test_send_welcome_email_renders_correctly(self):
        EmailService.send_welcome_email(
            user=self.user,
            protocol="http",
            domain="localhost:8000",
        )
        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        self.assertIn("Welcome to Volcann!", email.subject)
        self.assertIn("http://localhost:8000", email.body)
