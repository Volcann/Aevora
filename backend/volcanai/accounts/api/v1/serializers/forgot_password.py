from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value: str) -> str:
        cleaned = value.strip().lower()
        self.user = User.objects.filter(email__iexact=cleaned).first()
        return cleaned
