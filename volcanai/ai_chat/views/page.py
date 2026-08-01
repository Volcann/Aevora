from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render

from volcanai.ai_chat.choices import MessageRole
from volcanai.ai_chat.models.chat_session import ChatSession
from volcanai.ai_chat.models.message import Message
from volcanai.ai_chat.services.tool_registry import tool_registry


@login_required
def chat_view(request):
    """Create a fresh session and redirect to it."""
    session = ChatSession.objects.create(user=request.user)
    return redirect("ai_chat:chat_session", session_id=session.id)


@login_required
def chat_session_view(request, session_id):
    """Render the chat UI for a specific session."""
    session = get_object_or_404(ChatSession, id=session_id, user=request.user)

    # Sidebar: last 20 sessions with a human-readable title
    recent = (
        ChatSession.objects.filter(user=request.user)
        .order_by("-updated_at")[:20]
    )
    session_list = []
    for s in recent:
        first = (
            Message.objects.filter(session=s, role=MessageRole.HUMAN)
            .order_by("created_at")
            .values_list("content", flat=True)
            .first()
        )
        title = (
            (first[:48] + "…") if first and len(first) > 48
            else (first or "New Chat")
        )
        session_list.append({"session": s, "title": title})

    # Message history for the current session
    messages = (
        Message.objects.filter(
            session=session,
            role__in=[MessageRole.HUMAN, MessageRole.AI_GENERATED],
        )
        .order_by("created_at")
    )

    available_tools = tool_registry.get_gemini_declarations()

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
