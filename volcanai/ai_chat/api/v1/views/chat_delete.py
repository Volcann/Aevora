from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_POST

from volcanai.ai_chat.models import ChatSession, Message


@login_required
@require_POST
def delete_session(request, session_id):
    try:
        session = get_object_or_404(ChatSession, id=session_id, user=request.user)
        Message.objects.filter(session=session).delete()
        session.delete()
        return JsonResponse(
            {
                "ok": True,
                "message": "Chat session and related messages deleted successfully.",
            }
        )
    except ChatSession.DoesNotExist:
        return JsonResponse(
            {
                "ok": False,
                "error": "Chat session not found.",
            },
            status=404,
        )
