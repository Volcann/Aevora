from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404, StreamingHttpResponse
from django.shortcuts import get_object_or_404
from drf_yasg.utils import swagger_auto_schema
from rest_framework.views import APIView

from aevora.ai_chat.api.v1.docs.stream import chat_stream_schema
from aevora.ai_chat.api.v1.serializers.prompt import ChatStreamPromptSerializer
from aevora.ai_chat.models import AIModel
from aevora.ai_chat.utils import _gemini_stream, _sse, get_or_create_chat_session


class ChatStreamView(APIView):
    @swagger_auto_schema(**chat_stream_schema)
    def post(self, request):
        serializer = ChatStreamPromptSerializer(data=request.data)
        if not serializer.is_valid():
            return StreamingHttpResponse(
                iter([_sse({"type": "done"})]),
                content_type="text/event-stream",
            )

        prompt = serializer.validated_data.get("prompt", "")
        model = None
        model_id = serializer.validated_data.get("model", None)
        if model_id:
            try:
                model = get_object_or_404(AIModel, id=str(model_id).strip())
            except (DjangoValidationError, ValueError):
                raise Http404("AI Model not found")

        session, is_new = get_or_create_chat_session(
            user=request.user,
            session_id=request.query_params.get("session_id"),
            prompt=prompt,
        )

        return StreamingHttpResponse(
            _gemini_stream(
                session,
                prompt,
                is_new=is_new,
                model=model,
            ),
            content_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )
