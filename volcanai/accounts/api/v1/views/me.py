from drf_yasg.utils import swagger_auto_schema
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from volcanai.accounts.api.v1.docs.me import me_get_schema, me_patch_schema
from volcanai.accounts.api.v1.serializers.me import UserMeSerializer


class MeView(generics.RetrieveUpdateAPIView):
    permission_classes = (IsAuthenticated,)
    serializer_class = UserMeSerializer

    def get_object(self):
        return self.request.user

    @swagger_auto_schema(**me_get_schema)
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @swagger_auto_schema(**me_patch_schema)
    def patch(self, request, *args, **kwargs):
        return super().patch(request, *args, **kwargs)

    @swagger_auto_schema(**me_patch_schema)
    def put(self, request, *args, **kwargs):
        return super().put(request, *args, **kwargs)
