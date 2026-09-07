from django.http import StreamingHttpResponse
from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from volcanai.ai_chat.api.v1.serializers.prompt import ChatStreamPromptSerializer
from volcanai.ai_chat.models import ChatSession
from volcanai.ai_chat.utils import _gemini_stream, _sse


class ChatStreamView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request, session_id):
        session = get_object_or_404(ChatSession, id=session_id, user=request.user)
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

        return StreamingHttpResponse(
            _gemini_stream(session, prompt),
            content_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )
