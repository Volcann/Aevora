import json
import time

import redis
from django.conf import settings

from aevora.ai_chat.models import AILog
from aevora.celery import app


class CeleryToolClient:
    QUEUE = "laptop.tools"

    def __init__(
        self,
        celery_app=app,
    ) -> None:
        self._app = celery_app
        self._redis = redis.from_url(settings.REDIS_URL)
        self._queue = self.QUEUE

    def list_tools(self) -> list[dict]:
        background_job = app.send_task("tools.list_tools", queue=self._queue)
        return background_job.get(timeout=10)

    def call_tool_async(
        self,
        function_call,
        arguments: dict | None = None,
    ):
        if not function_call:
            raise ValueError("FunctionCall is required")

        if isinstance(function_call, str):
            tool_name = function_call
            tool_args = arguments or {}
        else:
            tool_name = function_call.name
            tool_args = dict(function_call.args) if getattr(function_call, "args", None) else {}

        task_name = f"tools.{tool_name}"
        return app.send_task(task_name, kwargs=tool_args, queue=self._queue)

    def watch_job(self, background_job, message_id: str, tool_name: str = "tool") -> None:
        seen_msg = None
        while not background_job.ready():
            if background_job.state == "PROGRESS":
                message = background_job.info.get("msg", "Processing...")
                if message != seen_msg:
                    seen_msg = message
                    self._push(
                        background_job, message_id, message, status="running", tool_name=tool_name
                    )
            time.sleep(0.1)

        try:
            result = background_job.get()
        except Exception as exc:  # noqa: BLE001
            result = {"error": str(exc)}
        self._push(
            background_job,
            message_id,
            "Done!",
            status="completed",
            output=result,
            tool_name=tool_name,
        )

    def _push(
        self, background_job, message_id, step, *, status, output=None, tool_name: str | None = None
    ) -> None:
        name = tool_name or getattr(background_job, "name", None) or "tool"
        log = AILog.objects.create(message_id=message_id, text=f"[{name}] {step}")

        event = {
            "type": "tool_log",
            "log_id": str(log.id),
            "tool": tool_name,
            "step": step,
            "log": step,
            "status": status,
            "output": output,
        }
        self._redis.rpush(f"stream:{background_job.id}", json.dumps(event))
        self._redis.expire(f"stream:{background_job.id}", 120)

    def pop_event(self, job_id: str, timeout: int = 30) -> dict | None:
        item = self._redis.blpop(f"stream:{job_id}", timeout=timeout)
        if not item:
            return None
        _, raw = item
        return json.loads(raw)


celery_tool_client = CeleryToolClient(
    celery_app=app,
)
