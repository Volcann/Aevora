from django import forms


class LoginForm(forms.Form):
    username = forms.CharField(
        max_length=254,
        widget=forms.TextInput(
            attrs={
                "autocomplete": "username",
                "placeholder": "hello@example.com",
            },
        ),
    )
    password = forms.CharField(
        widget=forms.PasswordInput(
            attrs={
                "autocomplete": "current-password",
                "placeholder": "••••••••",
            },
        ),
    )
