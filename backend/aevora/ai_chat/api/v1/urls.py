from django.urls import path

from aevora.ai_chat.api.v1.views import (
    ChatSessionDetailView,
    ChatSessionListCreateView,
    ChatStreamView,
    ToolsListView,
)

app_name = "ai_chat"

urlpatterns = [
    path("sessions/", ChatSessionListCreateView.as_view(), name="sessions"),
    path("sessions/<uuid:session_id>/", ChatSessionDetailView.as_view(), name="session_detail"),
    path("sessions/<uuid:session_id>/stream/", ChatStreamView.as_view(), name="session_stream"),
    path("tools/", ToolsListView.as_view(), name="tools_list"),
    path("<uuid:session_id>/", ChatSessionDetailView.as_view(), name="chat_session"),
    path("<uuid:session_id>/stream/", ChatStreamView.as_view(), name="chat_stream"),
    path("<uuid:session_id>/delete/", ChatSessionDetailView.as_view(), name="delete_session"),
]
