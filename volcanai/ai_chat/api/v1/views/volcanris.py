from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, render

from volcanai.ai_chat.choices import MessageRole
from volcanai.ai_chat.models import ChatSession, Message


@login_required
def volcanris_view(request):
    session_id = request.GET.get("session_id")
    if session_id:
        session = get_object_or_404(ChatSession, id=session_id, user=request.user)
    else:
        session = (
            ChatSession.objects.filter(user=request.user, is_active=True)
            .order_by("-updated_at")
            .first()
        )
        if not session:
            session = ChatSession.objects.create(user=request.user)

    recent_sessions = ChatSession.objects.filter(user=request.user).order_by("-updated_at")[:10]
    messages = Message.objects.filter(
        session=session,
        role__in=[MessageRole.HUMAN, MessageRole.AI_GENERATED],
    ).order_by("created_at")

    return render(
        request,
        "ai_chat/volcanris.html",
        {
            "session": session,
            "recent_sessions": recent_sessions,
            "messages": messages,
        },
    )
