from django.db import models


class ToolCallStatus(models.TextChoices):
    QUEUED = "queued", "Queued"
    RUNNING = "running", "Running"
    DONE = "done", "Done"
    FAILED = "failed", "Failed"


class MessageRole(models.TextChoices):
    USER = "user", "User"
    MODEL = "model", "Model"
