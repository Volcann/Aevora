from django.contrib.auth import get_user_model
from rest_framework import serializers

from volcanai.accounts.services.password import PasswordService

User = get_user_model()


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value: str) -> str:
        cleaned = value.strip().lower()
        self.user = User.objects.filter(email__iexact=cleaned).first()
        return cleaned

    def send_reset_email(self, request=None) -> None:
        if getattr(self, "user", None):
            PasswordService.forgot_password(self.user, request=request)
