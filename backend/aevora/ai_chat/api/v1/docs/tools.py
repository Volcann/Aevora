from drf_yasg import openapi

tool_test_schema = {
    "operation_summary": "Test Tool",
    "operation_description": "Test a specific Celery tool asynchronously. Blocks until the task completes and returns output.",
    "tags": ["AI Chat Tools"],
    "request_body": openapi.Schema(
        type=openapi.TYPE_OBJECT,
        required=["tool_name"],
        properties={
            "tool_name": openapi.Schema(
                type=openapi.TYPE_STRING, description="Name of the tool (e.g. review_pr)"
            ),
            "arguments": openapi.Schema(
                type=openapi.TYPE_OBJECT, description='Arguments (e.g. {"pr_number": 42})'
            ),
        },
    ),
    "responses": {
        200: openapi.Response("Tool execution result"),
        400: openapi.Response("Bad request"),
        500: openapi.Response("Internal server error"),
    },
}

tools_list_schema = {
    "operation_summary": "List Tools",
    "operation_description": "Get a list of available tools.",
    "tags": ["AI Chat Tools"],
    "responses": {
        200: openapi.Response("List of available tools"),
    },
}
