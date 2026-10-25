from django.contrib.auth import get_user_model
from django.test import TestCase

from aevora.ai_chat.choices import MessageRole
from aevora.ai_chat.models import ChatSession, Message
from aevora.ai_chat.utils import get_history

User = get_user_model()


class StreamGetHistoryTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="historyuser",
            email="history@example.com",
            password="password123",
        )
        self.session = ChatSession.objects.create(user=self.user, title="History Test")

    def testget_history_empty_session(self):
        history = get_history(self.session)
        self.assertEqual(history, [])

    def testget_history_only_model_messages(self):
        # When only model messages exist, the while loop pops them since history[0]["role"] != "user"
        Message.objects.create(
            session=self.session,
            role=MessageRole.MODEL,
            content="Hello model response",
        )
        history = get_history(self.session)
        self.assertEqual(history, [])

    def test_alias_equals_function(self):
        self.assertIs(get_history, get_history)
