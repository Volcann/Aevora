from django.contrib import messages
from django.contrib.auth import get_user_model
from django.shortcuts import redirect, render

from volcanai.accounts.api.v1.forms.set_password import SetPasswordForm
from volcanai.accounts.services.tokens import ONBOARDING_PURPOSE, TokenService

User = get_user_model()


def set_password_view(request):
    raw_token = request.GET.get("token", "")
    valid_token = False

    if raw_token:
        _, error = TokenService.decode_token(raw_token, expected_purpose=ONBOARDING_PURPOSE)
        if not error:
            valid_token = True

    if request.method == "POST":
        form = SetPasswordForm(request.POST)
        if form.is_valid():
            posted_token = form.cleaned_data["token"]
            payload, error = TokenService.decode_token(
                posted_token,
                expected_purpose=ONBOARDING_PURPOSE,
            )
            if error:
                form.add_error(None, "Invalid or expired invitation link.")
            else:
                try:
                    user = User.objects.get(
                        id=payload["user_id"],
                        email=payload["email"],
                    )
                    user.set_password(form.cleaned_data["password"])
                    user.is_active = True
                    user.save(update_fields=["password", "is_active"])
                    messages.success(request, "Account activated! You can now sign in.")
                    return redirect("accounts:login")
                except (User.DoesNotExist, KeyError):
                    form.add_error(None, "User not found. Please contact your administrator.")
    else:
        form = SetPasswordForm(initial={"token": raw_token})

    return render(
        request,
        "accounts/set_password.html",
        {
            "form": form,
            "valid_token": valid_token,
            "token": raw_token,
        },
    )
