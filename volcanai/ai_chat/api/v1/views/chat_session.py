from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render

from volcanai.ai_chat.choices import MessageRole
from volcanai.ai_chat.models import ChatSession, Message
from volcanai.ai_chat.utils import get_available_tools_list


@login_required
def ai_chat(request):
    session = ChatSession.objects.create(user=request.user)
    return redirect("ai_chat:chat_session", session_id=session.id)


@login_required
def chat_session_view(request, session_id):
    session = get_object_or_404(ChatSession, id=session_id, user=request.user)

    recent = ChatSession.objects.filter(user=request.user).order_by("-updated_at")[:20]
    session_list = []
    for s in recent:
        first = (
            Message.objects.filter(session=s, role=MessageRole.HUMAN)
            .order_by("created_at")
            .values_list("content", flat=True)
            .first()
        )
        title = (first[:48] + "…") if first and len(first) > 48 else (first or "New Chat")
        session_list.append({"session": s, "title": title})

    messages = Message.objects.filter(
        session=session,
        role__in=[MessageRole.HUMAN, MessageRole.AI_GENERATED],
    ).order_by("created_at")

    available_tools = get_available_tools_list()

    return render(
        request,
        "ai_chat/chat.html",
        {
            "session": session,
            "session_list": session_list,
            "messages": messages,
            "available_tools": available_tools,
        },
    )
