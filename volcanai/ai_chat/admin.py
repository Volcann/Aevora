from django.contrib import admin

from volcanai.ai_chat.models import ChatSession, Message, ServerConfig, ToolCall

admin.site.register(ChatSession)
admin.site.register(Message)
admin.site.register(ServerConfig)
admin.site.register(ToolCall)
