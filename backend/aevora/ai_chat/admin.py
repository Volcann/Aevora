from django.contrib import admin

from aevora.ai_chat.models import ChatSession, Message, ToolCall

admin.site.register(ChatSession)
admin.site.register(Message)
admin.site.register(ToolCall)
