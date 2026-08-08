from drf_yasg import openapi

from aevora.accounts.api.v1.docs.schemas import LogoutSuccessSchema

logout_schema = {
    "operation_summary": "Log out",
    "operation_description": "Invalidate and blacklist refresh token to end session.",
    "tags": ["Accounts"],
    "responses": {
        200: openapi.Response("Logged out successfully", schema=LogoutSuccessSchema),
        401: openapi.Response("Authentication required"),
    },
}
