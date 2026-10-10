from django.http import StreamingHttpResponse
from django.shortcuts import get_object_or_404
from drf_yasg.utils import swagger_auto_schema
from rest_framework.views import APIView

from aevora.ai_chat.api.v1.docs.stream import chat_stream_schema
from aevora.ai_chat.api.v1.serializers.prompt import ChatStreamPromptSerializer
from aevora.ai_chat.models import ChatSession
from aevora.ai_chat.utils import _gemini_stream, _sse


class ChatStreamView(APIView):
    @swagger_auto_schema(**chat_stream_schema)
    def post(self, request, session_id):
        serializer = ChatStreamPromptSerializer(data=request.data)
        if not serializer.is_valid():
            prompt = request.POST.get("prompt", "").strip()
        else:
            prompt = serializer.validated_data["prompt"]

        if not prompt:
            return StreamingHttpResponse(
                iter([_sse({"type": "done"})]),
                content_type="text/event-stream",
            )

        if session_id.startswith("local-"):
            session = ChatSession.objects.create(
                user=request.user, title=prompt[:48] + ("…" if len(prompt) > 48 else "")
            )
            is_new = True
        else:
            session = get_object_or_404(ChatSession, id=session_id, user=request.user)
            is_new = False

        return StreamingHttpResponse(
            _gemini_stream(session, prompt, is_new=is_new),
            content_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )
