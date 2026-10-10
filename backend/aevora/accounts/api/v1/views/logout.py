import logging

from drf_yasg.utils import swagger_auto_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from aevora.accounts.api.v1.docs.logout import logout_schema
from aevora.accounts.api.v1.serializers.logout import LogoutSerializer

logger = logging.getLogger(__name__)


class LogoutView(APIView):
    @swagger_auto_schema(**logout_schema)
    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=False)
        refresh_token = request.data.get("refresh")
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                if hasattr(token, "blacklist"):
                    token.blacklist()
            except (TokenError, AttributeError) as exc:
                logger.warning("Token blacklisting skipped: %s", exc)
        return Response({"message": "Successfully logged out."}, status=status.HTTP_200_OK)
