from django.contrib import messages
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.shortcuts import redirect, render
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode

from volcanai.accounts.api.v1.forms.reset_password import ResetPasswordForm

User = get_user_model()


def reset_password_view(request, uidb64, token):
    valid_link = False
    user = None

    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid)
        if default_token_generator.check_token(user, token):
            valid_link = True
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        pass

    if request.method == "POST" and valid_link:
        form = ResetPasswordForm(request.POST)
        if form.is_valid():
            user.set_password(form.cleaned_data["password"])
            user.save(update_fields=["password"])
            messages.success(request, "Password reset successfully. You can now sign in.")
            return redirect("accounts:login")
    else:
        form = ResetPasswordForm()

    return render(
        request,
        "accounts/reset_password.html",
        {
            "form": form,
            "valid_link": valid_link,
        },
    )
