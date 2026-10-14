from django.contrib import admin

from aevora.ai_chat.models import AIModel, ChatSession, Message, ToolCall

admin.site.register(AIModel)
admin.site.register(ChatSession)
admin.site.register(Message)
admin.site.register(ToolCall)
