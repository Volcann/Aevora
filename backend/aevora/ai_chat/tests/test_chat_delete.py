from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from aevora.ai_chat.choices import MessageRole
from aevora.ai_chat.models import ChatSession, Message

User = get_user_model()


class ChatDeleteTestCase(APITestCase):
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

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertTrue(data["ok"])

        self.assertFalse(ChatSession.objects.filter(id=self.session.id).exists())
        self.assertFalse(Message.objects.filter(session_id=self.session.id).exists())

    def test_ai_chat_deletes_empty_sessions(self):
        self.client.force_authenticate(user=self.user)
        empty_session = ChatSession.objects.create(user=self.user, title="Empty Chat")
        human_only_session = ChatSession.objects.create(user=self.user, title="Human Only")
        Message.objects.create(
            session=human_only_session, role=MessageRole.USER, content="User question"
        )

        url = reverse("ai_chat:sessions")
        response = self.client.post(url, {})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        self.assertFalse(ChatSession.objects.filter(id=empty_session.id).exists())
        self.assertFalse(ChatSession.objects.filter(id=human_only_session.id).exists())
        self.assertTrue(ChatSession.objects.filter(id=self.session.id).exists())

    def test_chat_session_view_cleans_up_other_empty_sessions(self):
        self.client.force_authenticate(user=self.user)
        empty_session = ChatSession.objects.create(user=self.user, title="Empty Chat")

        url = reverse("ai_chat:session_detail", kwargs={"session_id": self.session.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertFalse(ChatSession.objects.filter(id=empty_session.id).exists())
        self.assertTrue(ChatSession.objects.filter(id=self.session.id).exists())

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
