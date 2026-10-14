import json

import google.generativeai as genai
from django.conf import settings

from aevora.ai_chat.choices import MessageRole
from aevora.ai_chat.models import AIModel, Message
from aevora.ai_chat.utils.selection import select_tools_for_prompt


def _sse(data):
    return f"data: {json.dumps(data)}\n\n"


def _gemini_stream(
    session,
    prompt,
    is_new=False,  # noqa: FBT002
    model_identifier=None,
):
    try:
        if is_new:
            yield _sse(
                {"type": "session_created", "session_id": str(session.id), "title": session.title}
            )

        genai.configure(api_key=settings.GEMINI_API_KEY)

        prior = list(
            Message.objects.filter(
                session=session,
                role=MessageRole.MODEL,
            ).order_by("created_at")
        )[-5:]

        history = [
            {
                "role": ("user" if message.role == MessageRole.USER else MessageRole.MODEL),
                "parts": [message.content],
            }
            for message in prior
        ]
        while history and history[0]["role"] != "user":
            history.pop(0)

        gemini_tools, tool_router = select_tools_for_prompt(prompt)

        selected_aimodel = None
        if model_identifier:
            selected_aimodel = (
                AIModel.objects.filter(name=str(model_identifier).strip()).first()
                or AIModel.objects.filter(id=str(model_identifier).strip()).first()
            )

        if selected_aimodel:
            primary_model = selected_aimodel.name
        elif model_identifier and str(model_identifier).strip():
            primary_model = str(model_identifier).strip()
        else:
            first_model = AIModel.objects.first()
            primary_model = (
                first_model.name
                if first_model
                else getattr(settings, "GEMINI_MODEL", "gemini-3.5-flash-lite")
            )

        model_kwargs = {"tools": gemini_tools}

        try:
            model = genai.GenerativeModel(
                model_name=primary_model,
                **model_kwargs,
            )
            chat = model.start_chat(history=history)
        except Exception:  # noqa: BLE001
            model = genai.GenerativeModel(
                model_name="gemini-3.5-flash-lite",
                **model_kwargs,
            )
            chat = model.start_chat(history=history)

        full_text = []
        user_input = prompt

        while True:
            response = chat.send_message(user_input, stream=True)

            for chunk in response:
                try:
                    if chunk.text:
                        full_text.append(chunk.text)
                        yield _sse({"type": "chunk", "text": chunk.text})
                except ValueError:
                    pass

            function_calls = []
            try:
                for part in response.candidates[0].content.parts:
                    fc = getattr(part, "function_call", None)
                    if fc and fc.name:
                        function_calls.append(fc)
            except (IndexError, AttributeError):
                pass

            if not function_calls:
                break

            tool_parts = []
            for fc in function_calls:
                yield _sse({"type": "tool_start", "tool": fc.name})
                try:
                    router_value = tool_router.get(fc.name)
                    if router_value == "celery":
                        import time

                        from aevora.ai_chat.services.mcp_manager import CeleryToolClient

                        client = CeleryToolClient()
                        args = dict(fc.args) if fc.args else {}

                        job = client.call_tool_async(fc.name, args)

                        while not job.ready():
                            if job.state == "PROGRESS":
                                msg = job.info.get("msg", "Processing...")
                                yield _sse({"type": "chunk", "text": f"\n\n*⏳ {msg}*\n"})
                            else:
                                yield _sse({"type": "ping"})
                            time.sleep(1.5)

                        result = job.get()
                    else:
                        result = None
                    yield _sse({"type": "tool_done", "tool": fc.name})
                    tool_parts.append(
                        genai.protos.Part(
                            function_response=genai.protos.FunctionResponse(
                                name=fc.name,
                                response={"result": result},
                            ),
                        ),
                    )
                except Exception as exc:  # noqa: BLE001
                    yield _sse({"type": "tool_error", "tool": fc.name})
                    tool_parts.append(
                        genai.protos.Part(
                            function_response=genai.protos.FunctionResponse(
                                name=fc.name,
                                response={"error": str(exc)},
                            ),
                        ),
                    )

            user_input = tool_parts

        Message.objects.create(
            session=session,
            role=MessageRole.USER,
            content=prompt,
            model=selected_aimodel,
        )
        Message.objects.create(
            session=session,
            role=MessageRole.MODEL,
            content="".join(full_text),
            model=selected_aimodel,
        )

        if not session.title:
            session.title = prompt[:48] + ("…" if len(prompt) > 48 else "")
            session.save(update_fields=["title", "updated_at"])

    except Exception as exc:  # noqa: BLE001
        yield _sse({"type": "chunk", "text": f"\n\n⚠ Error: {exc}"})

    yield _sse({"type": "done"})
