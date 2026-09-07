from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from volcanai.accounts.services.password import PasswordService


class ResetPasswordSerializer(serializers.Serializer):
    token = serializers.CharField()
    uid = serializers.CharField(required=False, allow_blank=True, default="")
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, attrs: dict) -> dict:
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        validate_password(attrs["password"])
        return attrs

    def save(self) -> dict[str, str]:
        return PasswordService.reset_password(
            token=self.validated_data["token"],
            password=self.validated_data["password"],
            uid=self.validated_data.get("uid") or None,
        )
