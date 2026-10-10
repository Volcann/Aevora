from drf_yasg import openapi

chat_session_list_schema = {
    "operation_summary": "List Chat Sessions",
    "operation_description": "Retrieve a list of chat sessions for the current user.",
    "tags": ["AI Chat Sessions"],
}

chat_session_create_schema = {
    "operation_summary": "Create Chat Session",
    "operation_description": "Create a new chat session.",
    "tags": ["AI Chat Sessions"],
}

chat_session_detail_schema = {
    "operation_summary": "Get Chat Session Details",
    "operation_description": "Retrieve details of a specific chat session by ID.",
    "tags": ["AI Chat Sessions"],
}

chat_session_update_schema = {
    "operation_summary": "Update Chat Session",
    "operation_description": "Update a specific chat session by ID.",
    "tags": ["AI Chat Sessions"],
}

chat_session_delete_schema = {
    "operation_summary": "Delete Chat Session",
    "operation_description": "Delete a chat session and all its messages.",
    "tags": ["AI Chat Sessions"],
    "responses": {
        204: openapi.Response("Chat session deleted successfully"),
    },
}
