import asyncio
import json
import threading

import google.generativeai as genai
from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from django.shortcuts import get_object_or_404

from aevora.ai_chat.choices import MessageRole
from aevora.ai_chat.models import AIModel, Message
from aevora.ai_chat.services import celery_tool_client
from aevora.ai_chat.utils.tools import get_gemini_tools


async def sync_to_async_gen(sync_iterable):
    """
    Bridge a synchronous generator to an ASGI-compliant async generator.

    This prevents Django's ASGIHandler from consuming sync iterators into a list.
    """
    loop = asyncio.get_running_loop()
    queue = asyncio.Queue()
    sentinel = object()
    stopped = threading.Event()

    def producer():
        try:
            for item in sync_iterable:
                if stopped.is_set():
                    break
                future = asyncio.run_coroutine_threadsafe(queue.put(item), loop)
                future.result()
        except Exception as exc:  # noqa: BLE001
            if not stopped.is_set():
                asyncio.run_coroutine_threadsafe(queue.put(exc), loop).result()
        finally:
            if not stopped.is_set():
                asyncio.run_coroutine_threadsafe(queue.put(sentinel), loop).result()

    threading.Thread(target=producer, daemon=True).start()

    try:
        while True:
            val = await queue.get()
            if val is sentinel:
                break
            if isinstance(val, Exception):
                raise val
            yield val
    finally:
        stopped.set()


def get_model(serializer):
    model = None
    model_id = serializer.validated_data.get("model", None)
    if model_id:
        try:
            model = get_object_or_404(AIModel, id=str(model_id).strip())
        except (DjangoValidationError, ValueError):
            raise Http404("AI Model not found")
    return model


def _sse(data):
    return f"data: {json.dumps(data)}\n\n"


def get_history(session):
    prior = list(
        Message.objects.filter(
            session=session,
        ).order_by("created_at")
    )[-5:]

    history = [
        {
            "role": ("user" if message.role == MessageRole.USER else MessageRole.MODEL),
            "parts": [message.content or ""],
        }
        for message in prior
    ]
    while history and history[0]["role"] != "user":
        history.pop(0)

    return history


def _gemini_stream(
    session,
    prompt,
    is_new=False,  # noqa: FBT002
    model=None,
):
    try:
        if is_new:
            yield _sse(
                {"type": "session_created", "session_id": str(session.id), "title": session.title}
            )

        genai.configure(api_key=settings.GEMINI_API_KEY)
        history = get_history(session)

        gemini_tools = get_gemini_tools()
        model_kwargs = {"tools": gemini_tools} if gemini_tools else {}
        selected_model = model.name if model else "gemini-3.5-flash-lite"
        try:
            genai_model = genai.GenerativeModel(
                model_name=selected_model,
                **model_kwargs,
            )
            chat = genai_model.start_chat(history=history)
        except Exception:  # noqa: BLE001
            genai_model = genai.GenerativeModel(
                model_name="gemini-3.5-flash-lite",
                **model_kwargs,
            )
            chat = genai_model.start_chat(history=history)

        Message.objects.create(session=session, role=MessageRole.USER, content=prompt, model=model)
        ai_msg = Message.objects.create(session=session, role=MessageRole.MODEL, model=model)

        full_text = []
        current_input = prompt
        while True:
            response = chat.send_message(current_input, stream=True)
            for chunk in response:
                try:
                    if chunk.text:
                        full_text.append(chunk.text)
                        yield _sse({"type": "chunk", "text": chunk.text})
                except ValueError:
                    pass

            function_call = None
            try:
                for part in response.candidates[0].content.parts:
                    if getattr(part, "function_call", None):
                        function_call = part.function_call
                        break
            except (IndexError, AttributeError):
                pass

            if not function_call:
                break

            yield _sse({"type": "tool_start", "tool": function_call.name})

            background_job = celery_tool_client.call_tool_async(function_call)
            threading.Thread(
                target=celery_tool_client.watch_job,
                args=(background_job, str(ai_msg.id), function_call.name),
                daemon=True,
            ).start()

            tool_output = {}
            while True:
                log_event = celery_tool_client.pop_event(background_job.id, timeout=30)

                if not log_event:
                    tool_output = {"error": "Tool execution timed out"}
                    yield _sse(
                        {
                            "type": "tool_error",
                            "tool": function_call.name,
                            "error": "Tool execution timed out",
                        }
                    )
                    break

                yield _sse(log_event)
                if log_event.get("status") == "completed":
                    tool_output = log_event.get("output") or {}
                    yield _sse(
                        {"type": "tool_done", "tool": function_call.name, "output": tool_output},
                    )
                    break

            current_input = {
                "function_response": {
                    "name": function_call.name,
                    "response": {"result": tool_output},
                }
            }

        ai_msg.content = "".join(full_text)
        ai_msg.save()
        yield _sse({"type": "done", "message_id": str(ai_msg.id)})
    except Exception as exc:  # noqa: BLE001
        yield _sse({"type": "chunk", "text": f"\n\n⚠ Error: {exc}"})
