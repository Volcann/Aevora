from django.db import models


class MessageRole(models.TextChoices):
    HUMAN = "human", "Human"
    AI_GENERATED = "ai_generated", "AI Generated"
    TOOL_RESULT = "tool_result", "Tool Result"


class ToolCallStatus(models.TextChoices):
    QUEUED = "queued", "Queued"
    RUNNING = "running", "Running"
    COMPLETED = "completed", "Completed"
    FAILED = "failed", "Failed"
    CANCELLED = "cancelled", "Cancelled"
