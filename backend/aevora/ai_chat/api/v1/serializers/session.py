import warnings
from typing import TYPE_CHECKING

from rest_framework import serializers

from aevora.ai_chat.api.v1.serializers.message import MessageSerializer
from aevora.ai_chat.models import ChatSession

if TYPE_CHECKING:
    # Preserved for backward compatibility in type checkers
    ChatSessionDetailSerializer = ChatSessionSerializer


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


def __getattr__(name: str):
    if name == "ChatSessionDetailSerializer":
        warnings.warn(
            "'ChatSessionDetailSerializer' is deprecated, use 'ChatSessionSerializer' instead.",
            DeprecationWarning,
            stacklevel=2,
        )
        return ChatSessionSerializer
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")


def __dir__():
    return sorted(list(globals().keys()) + ["ChatSessionDetailSerializer"])

