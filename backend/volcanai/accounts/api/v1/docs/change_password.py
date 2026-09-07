from drf_yasg import openapi

from volcanai.accounts.api.v1.docs.schemas import ChangePasswordSuccessSchema

change_password_schema = {
    "operation_summary": "Change password",
    "operation_description": "Change password for the authenticated user by verifying existing password.",
    "tags": ["Accounts"],
    "responses": {
        200: openapi.Response("Password changed successfully", schema=ChangePasswordSuccessSchema),
        400: openapi.Response("Validation error or incorrect old password"),
        401: openapi.Response("Authentication required"),
    },
}
