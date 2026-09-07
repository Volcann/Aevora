from drf_yasg import openapi

from volcanai.accounts.api.v1.docs.schemas import ForgotPasswordSuccessSchema

forgot_password_schema = {
    "operation_summary": "Forgot password",
    "operation_description": "Send a password reset email if the account exists.",
    "tags": ["Accounts"],
    "responses": {
        200: openapi.Response("Reset email dispatched", schema=ForgotPasswordSuccessSchema),
        400: openapi.Response("Validation error"),
    },
}
