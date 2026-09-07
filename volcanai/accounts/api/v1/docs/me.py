from drf_yasg import openapi

from volcanai.accounts.api.v1.docs.schemas import MeSuccessSchema

me_get_schema = {
    "operation_summary": "Get current user profile",
    "operation_description": "Retrieve profile and preferences of the authenticated user.",
    "tags": ["Accounts"],
    "responses": {
        200: openapi.Response("Profile retrieved successfully", schema=MeSuccessSchema),
        401: openapi.Response("Authentication required"),
    },
}

me_patch_schema = {
    "operation_summary": "Update user profile",
    "operation_description": "Update user preferences such as theme_config, first_name, or last_name.",
    "tags": ["Accounts"],
    "responses": {
        200: openapi.Response("Profile updated successfully", schema=MeSuccessSchema),
        400: openapi.Response("Validation error"),
        401: openapi.Response("Authentication required"),
    },
}
