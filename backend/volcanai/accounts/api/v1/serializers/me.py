from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


class UserMeSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "theme_config",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "username", "email", "is_active", "created_at", "updated_at")
