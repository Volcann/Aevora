from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from aevora.ai_chat.choices import MessageRole
from aevora.ai_chat.models import ChatSession, Message

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
    def test_stream_creates_session_for_local_id(self, mock_stream):
        mock_stream.return_value = iter([])
        self.client.force_authenticate(user=self.user)
        url = reverse("ai_chat:chat_stream", kwargs={"session_id": "local-12345"})
        response = self.client.post(url, {"prompt": "Hello new session"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            ChatSession.objects.filter(user=self.user, title="Hello new session").exists()
        )
