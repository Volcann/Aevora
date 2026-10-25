from drf_yasg.utils import swagger_auto_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from aevora.ai_chat.api.v1.docs.tools import tool_list_schema
from aevora.ai_chat.utils.tools import get_tool_list


class ToolListView(APIView):
    @swagger_auto_schema(**tool_list_schema)
    def get(self, request):
        return Response({"tools": get_tool_list()}, status=status.HTTP_200_OK)
