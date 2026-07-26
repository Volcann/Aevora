from django import forms


class SetPasswordForm(forms.Form):
    token = forms.CharField(widget=forms.HiddenInput())
    password = forms.CharField(
        min_length=8,
        widget=forms.PasswordInput(
            attrs={
                "autocomplete": "new-password",
                "placeholder": "••••••••",
            },
        ),
    )
    confirm_password = forms.CharField(
        widget=forms.PasswordInput(
            attrs={
                "autocomplete": "new-password",
                "placeholder": "••••••••",
            },
        ),
    )

    def clean(self):
        cleaned = super().clean()
        pw = cleaned.get("password")
        confirm = cleaned.get("confirm_password")
        if pw and confirm and pw != confirm:
            raise forms.ValidationError("Passwords do not match.")
        return cleaned
