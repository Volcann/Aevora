from drf_yasg.utils import swagger_auto_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from volcanai.accounts.api.v1.docs.set_password import set_initial_password_schema
from volcanai.accounts.api.v1.serializers.set_password import (
    SetInitialPasswordSerializer,
)


class SetInitialPasswordView(APIView):
    permission_classes = (AllowAny,)

    @swagger_auto_schema(**set_initial_password_schema)
    def post(self, request):
        serializer = SetInitialPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "message": "Account activated and password set successfully. You can now sign in.",
            },
            status=status.HTTP_200_OK,
        )
