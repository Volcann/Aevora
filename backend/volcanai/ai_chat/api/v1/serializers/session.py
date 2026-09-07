from rest_framework import serializers

from volcanai.accounts.api.v1.serializers.me import UserMeSerializer
from volcanai.ai_chat.api.v1.serializers.message import MessageSerializer
from volcanai.ai_chat.models import ChatSession


class ChatSessionSerializer(serializers.ModelSerializer):
    user = UserMeSerializer(read_only=True)
    message_count = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()

    class Meta:
        model = ChatSession
        fields = (
            "id",
            "user",
            "title",
            "is_active",
            "created_at",
            "updated_at",
            "message_count",
            "last_message",
        )
        read_only_fields = (
            "id",
            "user",
            "created_at",
            "updated_at",
            "message_count",
            "last_message",
        )

    def get_message_count(self, obj):
        return obj.messages.count()

    def get_last_message(self, obj):
        msg = obj.messages.order_by("-created_at").first()
        if msg:
            return {
                "id": str(msg.id),
                "role": msg.role,
                "content": msg.content[:100],
                "created_at": msg.created_at,
            }
        return None


class ChatSessionDetailSerializer(serializers.ModelSerializer):
    user = UserMeSerializer(read_only=True)
    messages = MessageSerializer(many=True, read_only=True)

    class Meta:
        model = ChatSession
        fields = (
            "id",
            "user",
            "title",
            "is_active",
            "created_at",
            "updated_at",
            "messages",
        )
        read_only_fields = ("id", "user", "created_at", "updated_at", "messages")
