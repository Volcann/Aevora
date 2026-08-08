from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from aevora.ai_chat.api.v1.serializers.session import (
    ChatSessionDetailSerializer,
    ChatSessionSerializer,
)
from aevora.ai_chat.models import ChatSession, Message
from aevora.ai_chat.utils import cleanup_empty_sessions


class ChatSessionListCreateView(generics.ListCreateAPIView):
    permission_classes = (IsAuthenticated,)
    serializer_class = ChatSessionSerializer
    search_fields = ("title",)
    ordering_fields = ("created_at", "updated_at", "title")
    ordering = ("-updated_at",)

    def get_queryset(self):
        cleanup_empty_sessions(self.request.user)
        return ChatSession.objects.filter(user=self.request.user, is_active=True).order_by(
            "-updated_at"
        )

    def perform_create(self, serializer):
        cleanup_empty_sessions(self.request.user)
        serializer.save(user=self.request.user)


class ChatSessionDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = (IsAuthenticated,)
    serializer_class = ChatSessionDetailSerializer
    lookup_field = "id"
    lookup_url_kwarg = "session_id"

    def get_queryset(self):
        return ChatSession.objects.filter(user=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        cleanup_empty_sessions(request.user, exclude_session_id=instance.id)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        Message.objects.filter(session=instance).delete()
        instance.delete()
        return Response(
            {
                "ok": True,
                "message": "Chat session and related messages deleted successfully.",
            },
            status=status.HTTP_200_OK,
        )
