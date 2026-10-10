from celery import Celery as _Celery


def _get_celery_app() -> _Celery:
    from aevora.celery import app

    return app


class CeleryToolClient:
    QUEUE = "laptop.tools"

    # Dynamically fetches the tool registry from the laptop worker!
    def list_tools(self) -> list[dict]:
        app = _get_celery_app()
        # Blocks until the worker responds with its tools
        job = app.send_task("tools.list_tools", queue=self.QUEUE)
        return job.get(timeout=10)

    # Dispatches the task to Celery dynamically based on tool name
    def call_tool_async(self, name: str, arguments: dict):
        app = _get_celery_app()
        # The laptop worker registered tasks as 'tools.<name>'
        task_name = f"tools.{name}"
        return app.send_task(task_name, kwargs=arguments, queue=self.QUEUE)
