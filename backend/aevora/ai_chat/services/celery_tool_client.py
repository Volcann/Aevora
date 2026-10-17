from aevora.celery import app


class CeleryToolClient:
    QUEUE = "laptop.tools"

    def list_tools(self) -> list[dict]:
        job = app.send_task("tools.list_tools", queue=self.QUEUE)
        return job.get(timeout=10)

    def call_tool_async(self, name: str, arguments: dict):
        task_name = f"tools.{name}"
        return app.send_task(task_name, kwargs=arguments, queue=self.QUEUE)
