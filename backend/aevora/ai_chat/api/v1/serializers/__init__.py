import warnings
from typing import TYPE_CHECKING

from aevora.ai_chat.api.v1.serializers.message import MessageSerializer
from aevora.ai_chat.api.v1.serializers.prompt import ChatStreamPromptSerializer
from aevora.ai_chat.api.v1.serializers.session import ChatSessionSerializer

if TYPE_CHECKING:
    from aevora.ai_chat.api.v1.serializers.session import (
        ChatSessionDetailSerializer,
    )

__all__ = [
    "ChatSessionSerializer",
    "ChatStreamPromptSerializer",
    "MessageSerializer",
]


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
    return sorted(__all__ + ["ChatSessionDetailSerializer"])

