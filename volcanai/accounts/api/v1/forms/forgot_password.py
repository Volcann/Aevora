from django import forms


class ForgotPasswordForm(forms.Form):
    email = forms.EmailField(
        widget=forms.EmailInput(
            attrs={
                "autocomplete": "email",
                "placeholder": "hello@example.com",
            },
        ),
    )
