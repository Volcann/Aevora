from drf_yasg.utils import swagger_auto_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from aevora.accounts.api.v1.docs.change_password import change_password_schema
from aevora.accounts.api.v1.serializers.change_password import ChangePasswordSerializer
from aevora.accounts.services.password import PasswordService


class ChangePasswordView(APIView):
    permission_classes = (IsAuthenticated,)

    @swagger_auto_schema(**change_password_schema)
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        PasswordService.change_password(
            user=request.user,
            old_password=data["old_password"],
            new_password=data["new_password"],
        )
        return Response(
            {"message": "Password changed successfully."},
            status=status.HTTP_200_OK,
        )
