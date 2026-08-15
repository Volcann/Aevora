from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, render

from volcanai.ai_chat.choices import MessageRole
from volcanai.ai_chat.models import ChatSession, Message
from volcanai.ai_chat.services.jarvis import generate_speech


@login_required
def jarvis_view(request):
    audio_data = None
    text = ""
    voice = "en-US-AriaNeural"

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

    if request.method == "POST":
        text = request.POST.get("text_input", "").strip()
        voice = request.POST.get("voice", "en-US-AriaNeural")

        if text:
            audio_data = generate_speech(text, voice)

    recent_sessions = ChatSession.objects.filter(user=request.user).order_by("-updated_at")[:10]
    messages = Message.objects.filter(
        session=session,
        role__in=[MessageRole.HUMAN, MessageRole.AI_GENERATED],
    ).order_by("created_at")

    return render(
        request,
        "ai_chat/jarvis.html",
        {
            "session": session,
            "recent_sessions": recent_sessions,
            "messages": messages,
            "audio_data": audio_data,
            "text": text,
            "voice": voice,
        },
    )
