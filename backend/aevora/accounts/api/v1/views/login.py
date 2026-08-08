from drf_yasg.utils import swagger_auto_schema
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView

from aevora.accounts.api.v1.docs.login import login_schema
from aevora.accounts.api.v1.serializers.login import LoginSerializer


class LoginView(TokenObtainPairView):
    permission_classes = (AllowAny,)
    serializer_class = LoginSerializer

    @swagger_auto_schema(**login_schema)
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)
