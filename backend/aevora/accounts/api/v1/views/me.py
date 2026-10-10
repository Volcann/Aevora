from drf_yasg.utils import swagger_auto_schema
from rest_framework import generics

from aevora.accounts.api.v1.docs.me import me_get_schema, me_patch_schema
from aevora.accounts.api.v1.serializers.me import UserMeSerializer


class MeView(generics.RetrieveUpdateAPIView):
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
