from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.shortcuts import render
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from volcanai.accounts.api.v1.forms.forgot_password import ForgotPasswordForm

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
                reset_url = request.build_absolute_uri(
                    f"/accounts/reset-password/{uid}/{token}/",
                )
                send_mail(
                    subject="Reset your Volcann password",
                    message=(
                        f"Hi {user.get_full_name() or user.username},\n\n"
                        f"Click the link below to reset your password:\n{reset_url}\n\n"
                        "If you did not request this, you can safely ignore this email."
                    ),
                    from_email=None,
                    recipient_list=[email],
                    fail_silently=True,
                )
            except User.DoesNotExist:
                pass
            sent = True
    else:
        form = ForgotPasswordForm()

    return render(request, "accounts/forgot_password.html", {"form": form, "sent": sent})
