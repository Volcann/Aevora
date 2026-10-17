from django.urls import path

from aevora.ai_chat.api.v1.views import (
    AIModelListView,
    ChatSessionViewSet,
    ChatStreamView,
)

app_name = "ai_chat"

urlpatterns = [
    path(
        "sessions/",
        ChatSessionViewSet.as_view({"get": "list"}),
        name="sessions",
    ),
    path(
        "sessions/<str:session_id>/",
        ChatSessionViewSet.as_view({"get": "retrieve", "delete": "destroy"}),
        name="session_detail",
    ),
    path("stream/", ChatStreamView.as_view(), name="stream"),
    path("models/", AIModelListView.as_view(), name="models_list"),
    path(
        "<str:session_id>/delete/",
        ChatSessionViewSet.as_view({"get": "retrieve", "delete": "destroy"}),
        name="delete_session",
    ),
    path(
        "<str:session_id>/",
        ChatSessionViewSet.as_view({"get": "retrieve", "delete": "destroy"}),
        name="chat_session",
    ),
]
