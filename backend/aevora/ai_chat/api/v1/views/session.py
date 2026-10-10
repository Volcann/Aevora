from django.utils.decorators import method_decorator
from drf_yasg.utils import swagger_auto_schema
from rest_framework import mixins, viewsets

from aevora.ai_chat.api.v1.docs.session import (
    chat_session_delete_schema,
    chat_session_detail_schema,
    chat_session_list_schema,
)
from aevora.ai_chat.api.v1.serializers.session import ChatSessionSerializer
from aevora.ai_chat.models import ChatSession


@method_decorator(name="list", decorator=swagger_auto_schema(**chat_session_list_schema))
@method_decorator(name="retrieve", decorator=swagger_auto_schema(**chat_session_detail_schema))
@method_decorator(name="destroy", decorator=swagger_auto_schema(**chat_session_delete_schema))
class ChatSessionViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    queryset = ChatSession.objects.all()
    serializer_class = ChatSessionSerializer
    lookup_field = "id"
    lookup_url_kwarg = "session_id"
    search_fields = ("title",)
    ordering_fields = ("created_at", "updated_at", "title")
    ordering = ("-updated_at",)

    def get_queryset(self):
        return ChatSession.objects.filter(user=self.request.user)
