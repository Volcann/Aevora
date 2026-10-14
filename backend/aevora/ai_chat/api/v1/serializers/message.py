from rest_framework import serializers

from aevora.ai_chat.api.v1.serializers.ai_model import AIModelSerializer
from aevora.ai_chat.models import Message


class MessageSerializer(serializers.ModelSerializer):
    model = AIModelSerializer(read_only=True)

    class Meta:
        model = Message
        fields = (
            "id",
            "session",
            "role",
            "content",
            "model",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "session", "created_at", "updated_at")
