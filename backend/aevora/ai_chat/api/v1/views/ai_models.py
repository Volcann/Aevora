from rest_framework import generics, status
from rest_framework.response import Response

from aevora.ai_chat.api.v1.serializers.ai_model import AIModelSerializer
from aevora.ai_chat.models import AIModel


class AIModelListView(generics.ListAPIView):
    serializer_class = AIModelSerializer
    pagination_class = None

    def get_queryset(self):
        return AIModel.objects.all().order_by("name")

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return Response({"models": serializer.data}, status=status.HTTP_200_OK)
