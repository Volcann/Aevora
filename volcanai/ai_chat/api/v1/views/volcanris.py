from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, render

from volcanai.ai_chat.choices import MessageRole
from volcanai.ai_chat.models import ChatSession, Message
from volcanai.ai_chat.utils import cleanup_empty_sessions


@login_required
def volcanris_view(request):
    session_id = request.GET.get("session_id")
    if session_id:
        session = get_object_or_404(ChatSession, id=session_id, user=request.user)
    else:
        cleanup_empty_sessions(request.user)
        session = (
            ChatSession.objects.filter(user=request.user, is_active=True)
            .order_by("-updated_at")
            .first()
        )
        if not session:
            session = ChatSession.objects.create(user=request.user)

    cleanup_empty_sessions(request.user, exclude_session_id=session.id)
    recent_sessions = ChatSession.objects.filter(user=request.user).order_by("-updated_at")[:10]
    chat_messages = Message.objects.filter(
        session=session,
        role__in=[MessageRole.USER, MessageRole.MODEL],
    ).order_by("created_at")

    return render(
        request,
        "ai_chat/volcanris.html",
        {
            "session": session,
            "recent_sessions": recent_sessions,
            "chat_messages": chat_messages,
        },
    )
