from drf_yasg.utils import swagger_auto_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from volcanai.accounts.api.v1.docs.forgot_password import forgot_password_schema
from volcanai.accounts.api.v1.serializers.forgot_password import ForgotPasswordSerializer
from volcanai.accounts.services.password import PasswordService


class ForgotPasswordView(APIView):
    permission_classes = (AllowAny,)

    @swagger_auto_schema(**forgot_password_schema)
    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = getattr(serializer, "user", None)
        if user:
            PasswordService.forgot_password(user, request=request)

        return Response(
            {"message": "If this email is registered, a password reset link has been sent."},
            status=status.HTTP_200_OK,
        )
