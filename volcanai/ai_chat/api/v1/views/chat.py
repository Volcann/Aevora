from django.contrib.auth.decorators import login_required
from django.http import StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_POST

from volcanai.ai_chat.models import ChatSession
from volcanai.ai_chat.utils import _gemini_stream, _sse


@login_required
@require_POST
def chat_stream(request, session_id):
    session = get_object_or_404(ChatSession, id=session_id, user=request.user)
    prompt = request.POST.get("prompt", "").strip()
    if not prompt:
        return StreamingHttpResponse(
            iter([_sse({"type": "done"})]),
            content_type="text/event-stream",
        )
    return StreamingHttpResponse(
        _gemini_stream(session, prompt),
        content_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
