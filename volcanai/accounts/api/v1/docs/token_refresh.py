from drf_yasg import openapi

from volcanai.accounts.api.v1.docs.schemas import TokenRefreshSuccessSchema

token_refresh_schema = {
    "operation_summary": "Refresh JWT token",
    "operation_description": "Obtain a fresh access token using a valid refresh token.",
    "tags": ["Accounts"],
    "responses": {
        200: openapi.Response("Token refreshed successfully", schema=TokenRefreshSuccessSchema),
        400: openapi.Response("Invalid or expired refresh token"),
    },
}
