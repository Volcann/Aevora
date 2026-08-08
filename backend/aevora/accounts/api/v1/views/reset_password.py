from drf_yasg.utils import swagger_auto_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from aevora.accounts.api.v1.docs.reset_password import reset_password_schema
from aevora.accounts.api.v1.serializers.reset_password import ResetPasswordSerializer
from aevora.accounts.services.password import PasswordService


class ResetPasswordView(APIView):
    permission_classes = (AllowAny,)

    @swagger_auto_schema(**reset_password_schema)
    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        PasswordService.reset_password(
            token=data["token"],
            password=data["password"],
            uid=data.get("uid") or None,
        )

        return Response(
            {"message": "Password reset successfully. You can now sign in with your new password."},
            status=status.HTTP_200_OK,
        )
