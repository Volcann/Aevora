from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404, StreamingHttpResponse
from django.shortcuts import get_object_or_404
from drf_yasg.utils import swagger_auto_schema
from rest_framework.views import APIView

from aevora.ai_chat.api.v1.docs.stream import chat_stream_schema
from aevora.ai_chat.api.v1.serializers.prompt import ChatStreamPromptSerializer
from aevora.ai_chat.models import ChatSession
from aevora.ai_chat.utils import _gemini_stream, _sse


class ChatStreamView(APIView):
    @swagger_auto_schema(**chat_stream_schema)
    def post(self, request):
        serializer = ChatStreamPromptSerializer(data=request.data)
        if not serializer.is_valid():
            prompt = (
                request.POST.get("prompt", "").strip()
                or str(request.data.get("prompt", "")).strip()
            )
            voice_mode = request.POST.get("voice_mode") in [True, "true", "1"] or request.data.get(
                "voice_mode"
            ) in [True, "true", "1"]
        else:
            prompt = serializer.validated_data["prompt"]
            voice_mode = bool(serializer.validated_data.get("voice_mode", False))

        if not voice_mode:
            voice_mode = request.query_params.get("voice_mode") in ["true", "1", "True"]

        if not prompt:
            return StreamingHttpResponse(
                iter([_sse({"type": "done"})]),
                content_type="text/event-stream",
            )

        session_id = request.query_params.get("session_id")
        if session_id:
            try:
                session = get_object_or_404(ChatSession, id=session_id.strip(), user=request.user)
            except (DjangoValidationError, ValueError):
                raise Http404("Chat session not found")
            is_new = False
        else:
            session = ChatSession.objects.create(
                user=request.user, title=prompt[:48] + ("…" if len(prompt) > 48 else "")
            )
            is_new = True

        return StreamingHttpResponse(
            _gemini_stream(session, prompt, is_new=is_new, voice_mode=voice_mode),
            content_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )
