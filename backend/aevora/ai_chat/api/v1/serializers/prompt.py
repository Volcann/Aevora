from rest_framework import serializers


class ChatStreamPromptSerializer(serializers.Serializer):
    prompt = serializers.CharField(required=True, allow_blank=False, trim_whitespace=True)
