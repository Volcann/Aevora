import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from aevora.ai_chat.api.v1.serializers import ChatSessionSerializer
from aevora.ai_chat.choices import MessageRole
from aevora.ai_chat.models import ChatSession, Message

User = get_user_model()


class ChatSessionSerializerTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="serializertestuser",
            email="serializertest@example.com",
            password="password123",
        )
        self.session = ChatSession.objects.create(user=self.user, title="Serializer Chat")
        self.message = Message.objects.create(
            session=self.session,
            role=MessageRole.USER,
            content="Hello from test",
        )

    def test_chat_session_serializer(self):
        serializer = ChatSessionSerializer(self.session)
        data = serializer.data
        assert data["id"] == str(self.session.id)
        assert data["title"] == "Serializer Chat"
        assert len(data["messages"]) == 1
        assert data["messages"][0]["content"] == "Hello from test"

    def test_chat_session_detail_serializer_removed(self):
        with pytest.raises(ImportError):
            from aevora.ai_chat.api.v1.serializers.session import (  # noqa: F401
                ChatSessionDetailSerializer,
            )

        with pytest.raises(ImportError):
            from aevora.ai_chat.api.v1.serializers import (  # noqa: F401
                ChatSessionDetailSerializer,
            )

        import aevora.ai_chat.api.v1.serializers as serializers_pkg
        from aevora.ai_chat.api.v1.serializers import session as session_module

        assert "ChatSessionDetailSerializer" not in dir(session_module)
        assert "ChatSessionDetailSerializer" not in dir(serializers_pkg)

