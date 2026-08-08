from drf_yasg import openapi

from aevora.accounts.api.v1.docs.schemas import LoginSuccessSchema

login_schema = {
    "operation_summary": "Log in",
    "operation_description": "Authenticate user with email and password to receive JWT tokens and user profile.",
    "tags": ["Accounts"],
    "responses": {
        200: openapi.Response("Login successful", schema=LoginSuccessSchema),
        400: openapi.Response("Invalid credentials or payload"),
        401: openapi.Response("Account inactive or authentication failed"),
    },
}
