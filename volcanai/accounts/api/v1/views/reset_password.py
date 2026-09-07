from drf_yasg.utils import swagger_auto_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from volcanai.accounts.api.v1.docs.reset_password import reset_password_schema
from volcanai.accounts.api.v1.serializers.reset_password import ResetPasswordSerializer


class ResetPasswordView(APIView):
    permission_classes = (AllowAny,)

    @swagger_auto_schema(**reset_password_schema)
    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        return Response(result, status=status.HTTP_200_OK)
