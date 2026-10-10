import warnings
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from aevora.ai_chat.api.v1.serializers import (
    ChatSessionSerializer,
)
from aevora.ai_chat.choices import MessageRole
from aevora.ai_chat.models import ChatSession, Message

User = get_user_model()


class ChatSessionSerializerBackwardCompatibilityTestCase(APITestCase):
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

    def test_direct_session_serializer(self):
        serializer = ChatSessionSerializer(self.session)
        data = serializer.data
        assert data["id"] == str(self.session.id)
        assert data["title"] == "Serializer Chat"
        assert len(data["messages"]) == 1
        assert data["messages"][0]["content"] == "Hello from test"

    def test_backward_compatibility_import_from_session_module(self):
        with warnings.catch_warnings(record=True) as recorded_warnings:
            warnings.simplefilter("always")
            from aevora.ai_chat.api.v1.serializers.session import ChatSessionDetailSerializer

            assert ChatSessionDetailSerializer is ChatSessionSerializer
            assert any(
                issubclass(w.category, DeprecationWarning)
                and "ChatSessionDetailSerializer" in str(w.message)
                for w in recorded_warnings
            )

            # Check that it functions identically
            detail_serializer = ChatSessionDetailSerializer(self.session)
            assert detail_serializer.data == ChatSessionSerializer(self.session).data

    def test_backward_compatibility_import_from_package(self):
        with warnings.catch_warnings(record=True) as recorded_warnings:
            warnings.simplefilter("always")
            from aevora.ai_chat.api.v1.serializers import ChatSessionDetailSerializer

            assert ChatSessionDetailSerializer is ChatSessionSerializer
            assert any(
                issubclass(w.category, DeprecationWarning)
                and "ChatSessionDetailSerializer" in str(w.message)
                for w in recorded_warnings
            )

    def test_dir_and_attribute_errors(self):
        import aevora.ai_chat.api.v1.serializers as serializers_pkg
        from aevora.ai_chat.api.v1.serializers import session as session_module

        assert "ChatSessionDetailSerializer" in dir(session_module)
        assert "ChatSessionDetailSerializer" in dir(serializers_pkg)

        with pytest.raises(AttributeError):
            _ = session_module.NonExistentAttribute

        with pytest.raises(AttributeError):
            _ = serializers_pkg.NonExistentAttribute
