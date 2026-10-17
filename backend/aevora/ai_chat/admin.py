from django.contrib import admin

from aevora.ai_chat.models import AILog, AIModel, ChatSession, Message

admin.site.register(AIModel)
admin.site.register(ChatSession)
admin.site.register(Message)
admin.site.register(AILog)
