from drf_yasg import openapi

from aevora.accounts.api.v1.docs.schemas import SetInitialPasswordSuccessSchema

set_initial_password_schema = {
    "operation_summary": "Set initial password",
    "operation_description": "Activate account and set initial password via onboarding token.",
    "tags": ["Accounts"],
    "responses": {
        200: openapi.Response(
            "Password set and account activated", schema=SetInitialPasswordSuccessSchema
        ),
        400: openapi.Response("Validation error"),
        401: openapi.Response("Invalid or expired onboarding token"),
    },
}
