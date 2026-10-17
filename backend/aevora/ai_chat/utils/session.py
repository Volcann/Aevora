from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from django.shortcuts import get_object_or_404

from aevora.ai_chat.choices import MessageRole
from aevora.ai_chat.models import AIModel, ChatSession


def get_model(serializer):
    model = None
    model_id = serializer.validated_data.get("model", None)
    if model_id:
        try:
            model = get_object_or_404(AIModel, id=str(model_id).strip())
        except (DjangoValidationError, ValueError):
            raise Http404("AI Model not found")
    return model


def get_or_create_chat_session(user, session_id=None, prompt=""):
    if session_id:
        try:
            session = get_object_or_404(ChatSession, id=str(session_id).strip(), user=user)
        except (DjangoValidationError, ValueError):
            raise Http404("Chat session not found")
        return session, False

    title = prompt[:48] + ("…" if len(prompt) > 48 else "")
    session = ChatSession.objects.create(user=user, title=title)
    return session, True


def cleanup_empty_sessions(user, exclude_session_id=None):
    if not user or not user.is_authenticated:
        return

    queryset = ChatSession.objects.filter(user=user).exclude(messages__role=MessageRole.MODEL)
    if exclude_session_id:
        queryset = queryset.exclude(id=exclude_session_id)
    queryset.delete()
