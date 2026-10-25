from drf_yasg import openapi

tool_list_schema = {
    "operation_summary": "List Available Tools",
    "operation_description": "Retrieve the list of registered tools from the Celery worker.",
    "tags": ["AI Chat Tools"],
    "responses": {
        200: openapi.Response("List of available tools"),
    },
}
