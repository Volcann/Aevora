from django.urls import path

from volcanai.ai_chat.api.v1.views.chat import chat_view

app_name = "ai_chat"

urlpatterns = [
    path("", chat_view, name="chat"),
]
