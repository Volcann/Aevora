from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management import call_command
from rest_framework import status
from rest_framework.test import APITestCase

from aevora.ai_chat.api.v1.serializers import AIModelSerializer, MessageSerializer
from aevora.ai_chat.choices import MessageRole
from aevora.ai_chat.models import AIModel, ChatSession, Message

User = get_user_model()


class AIModelTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="modeltestuser",
            email="modeltest@example.com",
            password="password123",
        )
        self.client.force_authenticate(user=self.user)
        self.ai_model = AIModel.objects.create(
            name="gemini-test-model",
            quota=Decimal("150.00"),
        )

    def test_ai_model_properties_and_str(self):
        assert self.ai_model.name == "gemini-test-model"
        assert self.ai_model.quota == Decimal("150.00")
        assert "gemini-test-model" in str(self.ai_model)

    def test_message_linked_to_model(self):
        session = ChatSession.objects.create(user=self.user, title="Test Chat")
        msg = Message.objects.create(
            session=session,
            role=MessageRole.USER,
            content="Hello AI",
            model=self.ai_model,
        )
        assert msg.model == self.ai_model
        assert msg.model.name == "gemini-test-model"

        serializer = MessageSerializer(msg)
        assert serializer.data["model"]["id"] == str(self.ai_model.id)
        assert serializer.data["model"]["name"] == "gemini-test-model"
        assert serializer.data["model"]["quota"] == "150.00"

    def test_ai_model_serializer(self):
        serializer = AIModelSerializer(self.ai_model)
        data = serializer.data
        assert data["name"] == "gemini-test-model"
        assert data["quota"] == "150.00"

    def test_ai_model_list_api(self):
        response = self.client.get("/api/v1/chat/models/")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "models" in data
        names = [m["name"] for m in data["models"]]
        assert "gemini-test-model" in names

    def test_seed_models_command(self):
        call_command("seed_models")
        assert AIModel.objects.filter(name="gemini-3.5-flash-lite").exists()
        assert AIModel.objects.filter(name="gemini-2.5-flash-lite").exists()
        assert AIModel.objects.filter(name="gemini-flash-lite-latest").exists()
        assert AIModel.objects.filter(name="gemini-3.1-flash-lite").exists()
        assert AIModel.objects.filter(name="gemini-3.1-flash-lite-preview").exists()
        assert AIModel.objects.filter(name="gemini-2.5-flash").exists()
