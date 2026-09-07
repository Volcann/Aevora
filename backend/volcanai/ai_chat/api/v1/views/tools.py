from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from volcanai.ai_chat.utils import get_available_tools_list


class ToolsListView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        tools = get_available_tools_list()
        return Response({"tools": tools}, status=status.HTTP_200_OK)
