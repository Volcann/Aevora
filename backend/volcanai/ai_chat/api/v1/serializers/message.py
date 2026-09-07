from rest_framework import serializers

from volcanai.ai_chat.models import Message


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = (
            "id",
            "session",
            "role",
            "content",
            "token_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "session", "created_at", "updated_at")
