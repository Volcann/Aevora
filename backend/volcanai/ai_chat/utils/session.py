from volcanai.ai_chat.choices import MessageRole
from volcanai.ai_chat.models import ChatSession


def cleanup_empty_sessions(user, exclude_session_id=None):
    if not user or not user.is_authenticated:
        return

    queryset = ChatSession.objects.filter(user=user).exclude(messages__role=MessageRole.MODEL)
    if exclude_session_id:
        queryset = queryset.exclude(id=exclude_session_id)
    queryset.delete()
