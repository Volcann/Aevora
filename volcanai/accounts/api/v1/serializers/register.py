import logging
from typing import Any, ClassVar

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers

from volcanai.accounts.services.email import EmailService

logger = logging.getLogger(__name__)
User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = (
            "username",
            "email",
            "password",
            "confirm_password",
            "first_name",
            "last_name",
        )
        extra_kwargs: ClassVar[dict[str, dict[str, Any]]] = {
            "password": {"write_only": True, "min_length": 8},
            "first_name": {"required": False, "allow_blank": True, "default": ""},
            "last_name": {"required": False, "allow_blank": True, "default": ""},
        }

    def validate_username(self, value: str) -> str:
        trimmed = value.strip()
        if User.objects.filter(username__iexact=trimmed).exists():
            raise serializers.ValidationError("This username is already taken.")
        return trimmed

    def validate_email(self, value: str) -> str:
        lowered = value.strip().lower()
        if User.objects.filter(email__iexact=lowered).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return lowered

    def validate(self, attrs: dict) -> dict:
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        validate_password(attrs["password"])
        return attrs

    def create(self, validated_data: dict):
        validated_data.pop("confirm_password", None)
        password = validated_data.pop("password")

        with transaction.atomic():
            user = super().create(validated_data)
            user.set_password(password)
            user.save(update_fields=["password"])

        try:
            EmailService.send_welcome_email(user=user)
        except Exception:
            logger.exception("Failed to send welcome email to %s", user.email)

        return user
