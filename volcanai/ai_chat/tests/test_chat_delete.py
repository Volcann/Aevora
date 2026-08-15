from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from volcanai.ai_chat.choices import MessageRole
from volcanai.ai_chat.models import ChatSession, Message

User = get_user_model()


class ChatDeleteTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="password123",
        )
        self.session = ChatSession.objects.create(user=self.user, title="Test Chat")
        self.msg1 = Message.objects.create(
            session=self.session,
            role=MessageRole.HUMAN,
            content="Hello",
        )
        self.msg2 = Message.objects.create(
            session=self.session,
            role=MessageRole.AI_GENERATED,
            content="Hi there!",
        )

    def test_delete_session_requires_login(self):
        url = reverse("ai_chat:delete_session", kwargs={"session_id": self.session.id})
        response = self.client.post(url)
        self.assertEqual(response.status_code, 302)

    def test_delete_session_deletes_session_and_messages(self):
        self.client.login(username="testuser", password="password123")
        url = reverse("ai_chat:delete_session", kwargs={"session_id": self.session.id})
        response = self.client.post(url)

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["ok"])

        self.assertFalse(ChatSession.objects.filter(id=self.session.id).exists())
        self.assertFalse(Message.objects.filter(session_id=self.session.id).exists())

    def test_ai_chat_deletes_empty_sessions(self):
        self.client.login(username="testuser", password="password123")
        empty_session = ChatSession.objects.create(user=self.user, title="Empty Chat")
        human_only_session = ChatSession.objects.create(user=self.user, title="Human Only")
        Message.objects.create(
            session=human_only_session, role=MessageRole.HUMAN, content="User question"
        )

        url = reverse("ai_chat:ai_chat")
        response = self.client.get(url)
        self.assertEqual(response.status_code, 302)

        self.assertFalse(ChatSession.objects.filter(id=empty_session.id).exists())
        self.assertFalse(ChatSession.objects.filter(id=human_only_session.id).exists())
        self.assertTrue(ChatSession.objects.filter(id=self.session.id).exists())

    def test_chat_session_view_cleans_up_other_empty_sessions(self):
        self.client.login(username="testuser", password="password123")
        empty_session = ChatSession.objects.create(user=self.user, title="Empty Chat")

        url = reverse("ai_chat:chat_session", kwargs={"session_id": self.session.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)

        self.assertFalse(ChatSession.objects.filter(id=empty_session.id).exists())
        self.assertTrue(ChatSession.objects.filter(id=self.session.id).exists())
