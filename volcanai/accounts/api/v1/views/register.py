from django.contrib import messages
from django.contrib.auth import get_user_model, login
from django.shortcuts import redirect, render

from volcanai.accounts.api.v1.forms.register import RegisterForm

User = get_user_model()


def register_view(request):
    if request.user.is_authenticated:
        return redirect("dashboard:index")

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
            messages.success(request, f"Welcome to Volcann, {user.first_name or user.username}! 🎉")
            return redirect("dashboard:index")
    else:
        form = RegisterForm()

    return render(request, "accounts/register.html", {"form": form})
