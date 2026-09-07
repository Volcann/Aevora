from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from volcanai.accounts.services.tokens import ONBOARDING_PURPOSE, TokenService

User = get_user_model()


class SetInitialPasswordSerializer(serializers.Serializer):
    token = serializers.CharField()
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, attrs: dict) -> dict:
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})

        validate_password(attrs["password"])

        payload, error = TokenService.decode_token(
            attrs["token"],
            expected_purpose=ONBOARDING_PURPOSE,
        )
        if error:
            raise serializers.ValidationError({"token": "Invalid or expired invitation link."})

        try:
            user = User.objects.get(id=payload["user_id"], email=payload["email"])
        except (User.DoesNotExist, KeyError):
            raise serializers.ValidationError({"token": "User not found for this invitation link."})

        attrs["user"] = user
        return attrs

    def save(self):
        user = self.validated_data["user"]
        user.set_password(self.validated_data["password"])
        user.is_active = True
        user.save(update_fields=["password", "is_active", "updated_at"])
        return user
