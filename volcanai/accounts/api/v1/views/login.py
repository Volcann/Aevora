from django.contrib.auth import authenticate, get_user_model, login
from django.shortcuts import redirect, render

from volcanai.accounts.api.v1.forms.login import LoginForm

User = get_user_model()


def login_view(request):
    if request.user.is_authenticated:
        return redirect("ai_chat:jarvis")

    if request.method == "POST":
        form = LoginForm(request.POST)
        if form.is_valid():
            user = authenticate(
                request,
                username=form.cleaned_data["username"],
                password=form.cleaned_data["password"],
            )
            if user is not None:
                login(request, user)
                return redirect(request.GET.get("next") or "ai_chat:jarvis")
            form.add_error(None, "Invalid username or password.")
    else:
        form = LoginForm()

    return render(request, "accounts/login.html", {"form": form})
