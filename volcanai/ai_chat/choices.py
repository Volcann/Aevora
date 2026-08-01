from django.db import models


class ToolCallStatus(models.TextChoices):
    QUEUED = "queued", "Queued"
    RUNNING = "running", "Running"
    DONE = "done", "Done"
    FAILED = "failed", "Failed"


class MessageRole(models.TextChoices):
    HUMAN = "human", "Human"
    AI_GENERATED = "ai_generated", "AI Generated"
    TOOL_RESULT = "tool_result", "Tool Result"
