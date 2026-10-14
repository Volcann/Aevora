from django.http import StreamingHttpResponse
from drf_yasg.utils import swagger_auto_schema
from rest_framework.views import APIView

from aevora.ai_chat.api.v1.docs.stream import chat_stream_schema
from aevora.ai_chat.api.v1.serializers.prompt import ChatStreamPromptSerializer
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
        model_name = serializer.validated_data.get("model", None)
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
                model_identifier=model_name,
            ),
            content_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )
