from rest_framework import serializers


class ChatStreamPromptSerializer(serializers.Serializer):
    prompt = serializers.CharField(required=True, allow_blank=False, trim_whitespace=True)
    model = serializers.CharField(required=False, allow_blank=True, allow_null=True)
