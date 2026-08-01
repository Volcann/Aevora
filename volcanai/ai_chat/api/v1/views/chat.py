import json

import google.generativeai as genai
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.http import StreamingHttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from volcanai.ai_chat.choices import MessageRole
from volcanai.ai_chat.models import ChatSession, Message
from volcanai.ai_chat.services.mcp_manager import mcp_manager
from volcanai.ai_chat.services.tool_registry import tool_registry


def _sse(data):
    return f"data: {json.dumps(data)}\n\n"


def _json_schema_to_gemini(schema):
    type_map = {
        "string": genai.protos.Type.STRING,
        "number": genai.protos.Type.NUMBER,
        "integer": genai.protos.Type.INTEGER,
        "boolean": genai.protos.Type.BOOLEAN,
        "array": genai.protos.Type.ARRAY,
        "object": genai.protos.Type.OBJECT,
    }
    t = type_map.get(schema.get("type", "object"), genai.protos.Type.OBJECT)
    kw = {"type_": t}
    if desc := schema.get("description"):
        kw["description"] = desc
    if props := schema.get("properties"):
        kw["properties"] = {k: _json_schema_to_gemini(v) for k, v in props.items()}
    if req := schema.get("required"):
        kw["required"] = req
    if items_schema := schema.get("items"):
        kw["items"] = _json_schema_to_gemini(items_schema)
    return genai.protos.Schema(**kw)


def _build_gemini_tools(declarations):
    if not declarations:
        return None
    fds = [
        genai.protos.FunctionDeclaration(
            name=d["name"],
            description=d.get("description", ""),
            parameters=_json_schema_to_gemini(d.get("parameters", {})),
        )
        for d in declarations
    ]
    return [genai.protos.Tool(function_declarations=fds)]


def _invoke_mcp(tool_name, args):
    server_name = tool_registry.get_server(tool_name)
    if not server_name:
        raise RuntimeError(f"No server registered for tool '{tool_name}'")
    proc = mcp_manager.get_process(server_name)
    if not proc or not proc.is_alive():
        raise RuntimeError(f"MCP server '{server_name}' is not running")
    with proc.lock:
        return proc.call_tool(tool_name, args)


def _gemini_stream(session, prompt):
    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)

        prior = list(
            Message.objects.filter(
                session=session,
                role__in=[MessageRole.HUMAN, MessageRole.AI_GENERATED],
            ).order_by("created_at"),
        )

        history = [
            {
                "role": "user" if m.role == MessageRole.HUMAN else "model",
                "parts": [m.content],
            }
            for m in prior
        ]

        declarations = tool_registry.get_gemini_declarations()
        tools = _build_gemini_tools(declarations)

        model = genai.GenerativeModel(
            model_name=getattr(settings, "GEMINI_MODEL", "gemini-2.5-flash"),
            tools=tools,
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
                    result = _invoke_mcp(fc.name, dict(fc.args))
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

        Message.objects.create(session=session, role=MessageRole.HUMAN, content=prompt)
        Message.objects.create(
            session=session,
            role=MessageRole.AI_GENERATED,
            content="".join(full_text),
        )

        if not session.title:
            session.title = prompt[:48] + ("…" if len(prompt) > 48 else "")
            session.save(update_fields=["title", "updated_at"])

    except Exception as exc:  # noqa: BLE001
        yield _sse({"type": "chunk", "text": f"\n\n⚠ Error: {exc}"})

    yield _sse({"type": "done"})


@login_required
def ai_chat(request):
    session = ChatSession.objects.create(user=request.user)
    return redirect("ai_chat:chat_session", session_id=session.id)


@login_required
def chat_session_view(request, session_id):
    session = get_object_or_404(ChatSession, id=session_id, user=request.user)

    recent = ChatSession.objects.filter(user=request.user).order_by("-updated_at")[:20]
    session_list = []
    for s in recent:
        first = (
            Message.objects.filter(session=s, role=MessageRole.HUMAN)
            .order_by("created_at")
            .values_list("content", flat=True)
            .first()
        )
        title = (first[:48] + "…") if first and len(first) > 48 else (first or "New Chat")
        session_list.append({"session": s, "title": title})

    messages = Message.objects.filter(
        session=session,
        role__in=[MessageRole.HUMAN, MessageRole.AI_GENERATED],
    ).order_by("created_at")

    available_tools = tool_registry.get_gemini_declarations()

    return render(
        request,
        "ai_chat/chat.html",
        {
            "session": session,
            "session_list": session_list,
            "messages": messages,
            "available_tools": available_tools,
        },
    )


@login_required
@require_POST
def chat_stream(request, session_id):
    session = get_object_or_404(ChatSession, id=session_id, user=request.user)
    prompt = request.POST.get("prompt", "").strip()
    if not prompt:
        return StreamingHttpResponse(
            iter([_sse({"type": "done"})]),
            content_type="text/event-stream",
        )
    return StreamingHttpResponse(
        _gemini_stream(session, prompt),
        content_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
