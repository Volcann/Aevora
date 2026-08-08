from drf_yasg import openapi

from aevora.accounts.api.v1.docs.schemas import ResetPasswordSuccessSchema

reset_password_schema = {
    "operation_summary": "Reset password",
    "operation_description": "Reset account password using a validated single-use token.",
    "tags": ["Accounts"],
    "responses": {
        200: openapi.Response("Password reset successfully", schema=ResetPasswordSuccessSchema),
        400: openapi.Response("Validation error or consumed token"),
        401: openapi.Response("Invalid or expired token"),
    },
}
