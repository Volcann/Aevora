from rest_framework import serializers

from aevora.ai_chat.models import AIModel


class AIModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIModel
        fields = "__all__"
        read_only_fields = (
            "id",
            "name",
            "quota",
            "created_at",
            "updated_at",
        )
