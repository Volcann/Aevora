from drf_yasg.utils import swagger_auto_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from aevora.ai_chat.api.v1.docs.tools import tool_test_schema
from aevora.ai_chat.services.mcp_manager import CeleryToolClient


class ToolTestView(APIView):
    @swagger_auto_schema(**tool_test_schema)
    def post(self, request):
        tool_name = request.data.get("tool_name")
        arguments = request.data.get("arguments", {})

        if not tool_name:
            return Response({"error": "tool_name is required"}, status=status.HTTP_400_BAD_REQUEST)

        client = CeleryToolClient()
        try:
            job = client.call_tool_async(tool_name, arguments)
            result = job.get(timeout=180)
            return Response({"result": result, "status": "SUCCESS"}, status=status.HTTP_200_OK)
        except Exception as exc:  # noqa: BLE001
            return Response({"error": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
