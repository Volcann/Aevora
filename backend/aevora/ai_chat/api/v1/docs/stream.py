from drf_yasg import openapi

chat_stream_schema = {
    "operation_summary": "Stream Chat",
    "operation_description": "Send a prompt to the AI and receive a streaming SSE response.",
    "tags": ["AI Chat"],
    "request_body": openapi.Schema(
        type=openapi.TYPE_OBJECT,
        required=["prompt"],
        properties={
            "prompt": openapi.Schema(
                type=openapi.TYPE_STRING, description="The message prompt to send to the AI."
            ),
        },
    ),
    "responses": {
        200: openapi.Response("SSE Stream of AI responses"),
        400: openapi.Response("Bad request"),
        404: openapi.Response("Chat session not found"),
    },
}
