from drf_yasg import openapi

UserSchema = openapi.Schema(
    type=openapi.TYPE_OBJECT,
    properties={
        "id": openapi.Schema(type=openapi.TYPE_STRING, format=openapi.FORMAT_UUID),
        "username": openapi.Schema(type=openapi.TYPE_STRING),
        "email": openapi.Schema(type=openapi.TYPE_STRING, format=openapi.FORMAT_EMAIL),
        "first_name": openapi.Schema(type=openapi.TYPE_STRING),
        "last_name": openapi.Schema(type=openapi.TYPE_STRING),
        "theme_config": openapi.Schema(type=openapi.TYPE_OBJECT),
        "is_active": openapi.Schema(type=openapi.TYPE_BOOLEAN),
        "created_at": openapi.Schema(type=openapi.TYPE_STRING, format=openapi.FORMAT_DATETIME),
        "updated_at": openapi.Schema(type=openapi.TYPE_STRING, format=openapi.FORMAT_DATETIME),
    },
)

TokensSchema = openapi.Schema(
    type=openapi.TYPE_OBJECT,
    properties={
        "access": openapi.Schema(type=openapi.TYPE_STRING),
        "refresh": openapi.Schema(type=openapi.TYPE_STRING),
    },
)

LoginSuccessSchema = openapi.Schema(
    type=openapi.TYPE_OBJECT,
    properties={
        "access": openapi.Schema(type=openapi.TYPE_STRING),
        "refresh": openapi.Schema(type=openapi.TYPE_STRING),
        "user": UserSchema,
    },
)

TokenRefreshSuccessSchema = openapi.Schema(
    type=openapi.TYPE_OBJECT,
    properties={
        "access": openapi.Schema(type=openapi.TYPE_STRING),
        "refresh": openapi.Schema(type=openapi.TYPE_STRING),
    },
)

MeSuccessSchema = UserSchema

RegisterSuccessSchema = openapi.Schema(
    type=openapi.TYPE_OBJECT,
    properties={
        "message": openapi.Schema(type=openapi.TYPE_STRING),
        "user": UserSchema,
        "tokens": TokensSchema,
    },
)

LogoutSuccessSchema = openapi.Schema(
    type=openapi.TYPE_OBJECT,
    properties={
        "message": openapi.Schema(type=openapi.TYPE_STRING),
    },
)

ForgotPasswordSuccessSchema = openapi.Schema(
    type=openapi.TYPE_OBJECT,
    properties={
        "message": openapi.Schema(type=openapi.TYPE_STRING),
    },
)

ResetPasswordSuccessSchema = openapi.Schema(
    type=openapi.TYPE_OBJECT,
    properties={
        "message": openapi.Schema(type=openapi.TYPE_STRING),
    },
)

SetInitialPasswordSuccessSchema = openapi.Schema(
    type=openapi.TYPE_OBJECT,
    properties={
        "access": openapi.Schema(type=openapi.TYPE_STRING),
        "refresh": openapi.Schema(type=openapi.TYPE_STRING),
        "message": openapi.Schema(type=openapi.TYPE_STRING),
    },
)

ChangePasswordSuccessSchema = openapi.Schema(
    type=openapi.TYPE_OBJECT,
    properties={
        "message": openapi.Schema(type=openapi.TYPE_STRING),
    },
)
