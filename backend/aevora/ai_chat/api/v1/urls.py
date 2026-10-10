from django.urls import path

from aevora.ai_chat.api.v1.views import (
    ChatSessionViewSet,
    ChatStreamView,
    ToolsListView,
    ToolTestView,
)

app_name = "ai_chat"

chat_session_list = ChatSessionViewSet.as_view({"get": "list"})

chat_session_detail = ChatSessionViewSet.as_view({"get": "retrieve", "delete": "destroy"})

urlpatterns = [
    path("sessions/", chat_session_list, name="sessions"),
    path("sessions/<str:session_id>/", chat_session_detail, name="session_detail"),
    path("sessions/<str:session_id>/stream/", ChatStreamView.as_view(), name="session_stream"),
    path("tools/", ToolsListView.as_view(), name="tools_list"),
    path("tools/test/", ToolTestView.as_view(), name="tool_test"),
    path("<str:session_id>/", chat_session_detail, name="chat_session"),
    path("<str:session_id>/stream/", ChatStreamView.as_view(), name="chat_stream"),
    path("<str:session_id>/delete/", chat_session_detail, name="delete_session"),
]
