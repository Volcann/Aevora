from django.urls import path

from volcanai.ai_chat.api.v1.views.chat import chat_stream
from volcanai.ai_chat.api.v1.views.chat_session import ai_chat, chat_session_view

app_name = "ai_chat"

urlpatterns = [
    path("", ai_chat, name="ai_chat"),
    path("<uuid:session_id>/", chat_session_view, name="chat_session"),
    path("<uuid:session_id>/stream/", chat_stream, name="chat_stream"),
]
