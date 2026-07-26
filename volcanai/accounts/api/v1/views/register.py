import logging

from django.contrib import messages
from django.contrib.auth import get_user_model, login
from django.shortcuts import redirect, render

from volcanai.accounts.api.v1.forms.register import RegisterForm
from volcanai.accounts.services.email import EmailService

logger = logging.getLogger(__name__)

User = get_user_model()


def register_view(request):
    if request.user.is_authenticated:
        return redirect("ai_chat")

    if request.method == "POST":
        form = RegisterForm(request.POST)
        if form.is_valid():
            data = form.cleaned_data
            user = User.objects.create_user(
                username=data["username"],
                email=data["email"],
                password=data["password"],
                first_name=data.get("first_name", ""),
                last_name=data.get("last_name", ""),
            )
            login(request, user)

            try:
                EmailService.send_welcome_email(user=user)
            except Exception:
                logger.exception("Failed to send welcome email to %s", user.email)

            messages.success(request, f"Welcome to Volcann, {user.first_name or user.username}! 🎉")
            return redirect("ai_chat")
    else:
        form = RegisterForm()

    return render(request, "accounts/register.html", {"form": form})
