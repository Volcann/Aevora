import logging

from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.shortcuts import render
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from volcanai.accounts.api.v1.forms.forgot_password import ForgotPasswordForm
from volcanai.accounts.services.email import EmailService

logger = logging.getLogger(__name__)

User = get_user_model()


def forgot_password_view(request):
    sent = False

    if request.method == "POST":
        form = ForgotPasswordForm(request.POST)
        if form.is_valid():
            email = form.cleaned_data["email"]
            try:
                user = User.objects.get(email=email)
                token = default_token_generator.make_token(user)
                uid = urlsafe_base64_encode(force_bytes(user.pk))
                protocol = "https" if request.is_secure() else "http"
                domain = request.get_host()

                EmailService.send_password_reset_email(
                    user=user,
                    uid=uid,
                    token=token,
                    protocol=protocol,
                    domain=domain,
                )
            except User.DoesNotExist:
                pass
            except Exception:
                logger.exception("Failed to send password reset email to %s", email)
            sent = True
    else:
        form = ForgotPasswordForm()

    return render(request, "accounts/forgot_password.html", {"form": form, "sent": sent})
