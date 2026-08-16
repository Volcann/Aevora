from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags


class EmailService:
    @staticmethod
    def _send(*, to: str, subject: str, template: str, context: dict) -> None:
        html_body = render_to_string(template, context)
        text_body = strip_tags(html_body)

        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[to],
        )
        msg.attach_alternative(html_body, "text/html")
        msg.send(fail_silently=False)

    @classmethod
    def send_welcome_email(
        cls,
        *,
        user,
        protocol: str = "http",
        domain: str = "localhost",
    ) -> None:
        cls._send(
            to=user.email,
            subject="Welcome to Volcann! 🎉",
            template="emails/sign_up.html",
            context={
                "user": user,
                "protocol": protocol,
                "domain": domain,
            },
        )

    @classmethod
    def send_password_reset_email(
        cls,
        *,
        user,
        uid: str,
        token: str,
        protocol: str = "http",
        domain: str = "localhost",
    ) -> None:
        cls._send(
            to=user.email,
            subject="Reset your Volcann password 🔒",
            template="emails/reset_password.html",
            context={
                "user": user,
                "uid": uid,
                "token": token,
                "protocol": protocol,
                "domain": domain,
            },
        )
