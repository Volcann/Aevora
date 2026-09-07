from drf_yasg.utils import swagger_auto_schema
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.views import TokenRefreshView

from volcanai.accounts.api.v1.docs.token_refresh import token_refresh_schema


class CustomTokenRefreshView(TokenRefreshView):
    permission_classes = (AllowAny,)
    serializer_class = TokenRefreshSerializer

    @swagger_auto_schema(**token_refresh_schema)
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)
