from drf_yasg.utils import swagger_auto_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from aevora.ai_chat.api.v1.docs.tools import tools_list_schema
from aevora.ai_chat.utils import get_available_tools_list


class ToolsListView(APIView):
    @swagger_auto_schema(**tools_list_schema)
    def get(self, request):
        tools = get_available_tools_list()
        return Response({"tools": tools}, status=status.HTTP_200_OK)
