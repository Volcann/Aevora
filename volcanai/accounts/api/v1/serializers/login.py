from django.contrib.auth import get_user_model
from django.db import DatabaseError
from django.db.models import Q
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()


class LoginSerializer(TokenObtainPairSerializer):
    email = serializers.CharField(required=False, allow_blank=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields[self.username_field].required = False
        self.fields[self.username_field].allow_blank = True

    def validate(self, attrs: dict) -> dict:
        identifier = (attrs.get("email") or attrs.get(self.username_field) or "").strip()
        if not identifier:
            raise serializers.ValidationError({"email": "Email or username is required."})

        try:
            user = User.objects.filter(
                Q(email__iexact=identifier) | Q(username__iexact=identifier)
            ).first()
        except DatabaseError:
            user = None

        if not user:
            raise AuthenticationFailed(
                "Invalid email or password.",
                "no_active_account",
            )

        if not user.is_active:
            raise AuthenticationFailed(
                "Account is not active.",
                "inactive_account",
            )

        attrs[self.username_field] = getattr(user, user.USERNAME_FIELD)

        try:
            data = super().validate(attrs)
        except AuthenticationFailed:
            raise AuthenticationFailed(
                "Invalid email or password.",
                "no_active_account",
            )

        data["user"] = {
            "id": str(self.user.id),
            "username": self.user.username,
            "email": self.user.email,
            "first_name": self.user.first_name,
            "last_name": self.user.last_name,
            "theme_config": getattr(self.user, "theme_config", {}),
        }
        return data
