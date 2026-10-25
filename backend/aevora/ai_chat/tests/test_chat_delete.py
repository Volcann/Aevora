from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from aevora.ai_chat.choices import MessageRole
from aevora.ai_chat.models import AIModel, ChatSession, Message

User = get_user_model()


class ChatSessionApiTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="password123",
        )
        self.session = ChatSession.objects.create(user=self.user, title="Test Chat")
        self.msg1 = Message.objects.create(
            session=self.session,
            role=MessageRole.USER,
            content="Hello",
        )
        self.msg2 = Message.objects.create(
            session=self.session,
            role=MessageRole.MODEL,
            content="Hi there!",
        )

    def test_delete_session_requires_login(self):
        url = reverse("ai_chat:delete_session", kwargs={"session_id": self.session.id})
        response = self.client.delete(url)
        self.assertIn(
            response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]
        )

    def test_delete_session_deletes_session_and_messages(self):
        self.client.force_authenticate(user=self.user)
        url = reverse("ai_chat:delete_session", kwargs={"session_id": self.session.id})
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(ChatSession.objects.filter(id=self.session.id).exists())
        self.assertFalse(Message.objects.filter(session_id=self.session.id).exists())

    def test_cannot_create_session_directly(self):
        self.client.force_authenticate(user=self.user)
        url = reverse("ai_chat:sessions")
        response = self.client.post(url, {"title": "Direct create"})
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_retrieve_session_returns_messages(self):
        self.client.force_authenticate(user=self.user)
        url = reverse("ai_chat:session_detail", kwargs={"session_id": self.session.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["id"], str(self.session.id))
        self.assertEqual(len(data["messages"]), 2)

    def test_sessions_list_pagination_and_filtering(self):
        self.client.force_authenticate(user=self.user)
        url = reverse("ai_chat:sessions")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("count", data)
        self.assertIn("results", data)
        self.assertIn("next", data)
        self.assertIn("previous", data)
        self.assertEqual(data["count"], 1)

        search_resp = self.client.get(f"{url}?search=Test")
        self.assertEqual(search_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(search_resp.json()["count"], 1)

        no_match_resp = self.client.get(f"{url}?search=NonExistent")
        self.assertEqual(no_match_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(no_match_resp.json()["count"], 0)

    @patch("aevora.ai_chat.api.v1.views.stream._gemini_stream")
    def test_stream_creates_session_when_session_id_omitted(self, mock_stream):
        mock_stream.return_value = iter([])
        self.client.force_authenticate(user=self.user)
        url = reverse("ai_chat:stream")
        response = self.client.post(url, {"prompt": "First message in brand new chat"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            ChatSession.objects.filter(
                user=self.user, title="First message in brand new chat"
            ).exists()
        )
        mock_stream.assert_called_once()
        self.assertTrue(mock_stream.call_args.kwargs.get("is_new"))

    @patch("aevora.ai_chat.api.v1.views.stream._gemini_stream")
    def test_stream_uses_existing_session_from_query_param(self, mock_stream):
        mock_stream.return_value = iter([])
        self.client.force_authenticate(user=self.user)
        url = f"{reverse('ai_chat:stream')}?session_id={self.session.id}"
        response = self.client.post(url, {"prompt": "Follow-up question"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_stream.assert_called_once()
        self.assertFalse(mock_stream.call_args.kwargs.get("is_new"))
        self.assertEqual(mock_stream.call_args.args[0].id, self.session.id)

    def test_stream_returns_404_for_nonexistent_or_invalid_session_id(self):
        self.client.force_authenticate(user=self.user)
        url = f"{reverse('ai_chat:stream')}?session_id=00000000-0000-0000-0000-000000000000"
        response = self.client.post(url, {"prompt": "Hello"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # Also non-UUID string format
        invalid_url = f"{reverse('ai_chat:stream')}?session_id=not-a-valid-uuid"
        response = self.client.post(invalid_url, {"prompt": "Hello"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @patch("aevora.ai_chat.api.v1.views.stream._gemini_stream")
    def test_stream_with_valid_model_id_passes_aimodel_object(self, mock_stream):
        mock_stream.return_value = iter([])
        self.client.force_authenticate(user=self.user)
        ai_model = AIModel.objects.create(name="gemini-test-custom")
        url = reverse("ai_chat:stream")
        response = self.client.post(
            url,
            {"prompt": "Hello test model", "model": str(ai_model.id)},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_stream.assert_called_once()
        self.assertEqual(mock_stream.call_args.kwargs.get("model"), ai_model)

    def test_stream_returns_404_for_nonexistent_or_invalid_model_id(self):
        self.client.force_authenticate(user=self.user)
        url = reverse("ai_chat:stream")

        # Non-existent UUID
        response = self.client.post(
            url,
            {"prompt": "Hello", "model": "00000000-0000-0000-0000-000000000000"},
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # Invalid UUID format
        response = self.client.post(
            url,
            {"prompt": "Hello", "model": "invalid-uuid-format"},
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @patch("google.generativeai.GenerativeModel")
    @patch("google.generativeai.configure")
    def test_gemini_stream_saves_message_with_model_object(self, mock_configure, mock_genai_model):
        from unittest.mock import MagicMock

        from aevora.ai_chat.utils.stream import _gemini_stream

        mock_instance = mock_genai_model.return_value
        mock_chat = mock_instance.start_chat.return_value
        mock_response = MagicMock()
        mock_response.__iter__.return_value = []
        mock_response.candidates = []
        mock_chat.send_message.return_value = mock_response

        stream_session = ChatSession.objects.create(user=self.user, title="Stream Model Test")
        ai_model = AIModel.objects.create(name="gemini-stream-unit-test")
        events = list(_gemini_stream(stream_session, "Test prompt", model=ai_model))
        self.assertTrue(len(events) > 0)

        user_message = Message.objects.get(session=stream_session, role=MessageRole.USER)
        self.assertEqual(user_message.model, ai_model)

        model_message = Message.objects.get(session=stream_session, role=MessageRole.MODEL)
        self.assertEqual(model_message.model, ai_model)
