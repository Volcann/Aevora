from drf_yasg import openapi

from aevora.accounts.api.v1.docs.schemas import RegisterSuccessSchema

register_schema = {
    "operation_summary": "Register user",
    "operation_description": "Create a new user account with email, username, and password, returning initial JWT tokens.",
    "tags": ["Accounts"],
    "responses": {
        201: openapi.Response("User registered successfully", schema=RegisterSuccessSchema),
        400: openapi.Response("Validation error or duplicate user"),
    },
}
