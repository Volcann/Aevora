from rest_framework import serializers

from aevora.ai_chat.api.v1.serializers.message import MessageSerializer
from aevora.ai_chat.models import ChatSession


class ChatSessionSerializer(serializers.ModelSerializer):
    messages = MessageSerializer(many=True, read_only=True)

    class Meta:
        model = ChatSession
        fields = (
            "id",
            "title",
            "is_active",
            "created_at",
            "updated_at",
            "messages",
        )
        read_only_fields = ("id", "created_at", "updated_at", "messages")
