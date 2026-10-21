from rest_framework import serializers

from aevora.ai_chat.models import AILog


class AILogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AILog
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")
