import json

import google.generativeai as genai
from django.conf import settings
from django.core.cache import cache

from volcanai.ai_chat.choices import MessageRole
from volcanai.ai_chat.models import Message, ServerConfig
from volcanai.ai_chat.services.mcp_manager import MCPClient


def _sse(data):
    return f"data: {json.dumps(data)}\n\n"


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

        gemini_tools, tool_router = get_all_tools_for_gemini()
        model = genai.GenerativeModel(
            model_name=getattr(settings, "GEMINI_MODEL", "gemini-2.5-flash"),
            tools=gemini_tools or None,
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
                    server = tool_router.get(fc.name)
                    if server:
                        client = MCPClient(server)
                        args = dict(fc.args) if fc.args else {}
                        result = client.call_tool(fc.name, args)
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


def get_all_tools_for_gemini(cache_seconds: int = 300) -> tuple[list, dict]:
    cached = cache.get("mcp_tools_cache")
    if cached is not None:
        return cached

    servers = ServerConfig.objects.filter(is_active=True)

    gemini_tools = []
    tool_router = {}

    for server in servers:
        try:
            client = MCPClient(server)
            tools = client.list_tools()

            for tool in tools:
                gemini_tools.append(
                    genai.protos.Tool(
                        function_declarations=[
                            genai.protos.FunctionDeclaration(
                                name=tool["name"],
                                description=tool.get("description", ""),
                                parameters=_mcp_schema_to_gemini(tool.get("inputSchema", {})),
                            )
                        ]
                    )
                )
                tool_router[tool["name"]] = server

        except Exception as exc:  # noqa: BLE001
            print(f"[MCP] Could not reach server '{server.name}': {exc}")

    cache.set("mcp_tools_cache", (gemini_tools, tool_router), cache_seconds)
    return gemini_tools, tool_router


def _mcp_schema_to_gemini(schema: dict):
    if not schema or schema.get("type") != "object":
        return None

    properties = {}
    type_map = {
        "string": genai.protos.Type.STRING,
        "integer": genai.protos.Type.INTEGER,
        "number": genai.protos.Type.NUMBER,
        "boolean": genai.protos.Type.BOOLEAN,
        "array": genai.protos.Type.ARRAY,
        "object": genai.protos.Type.OBJECT,
    }

    for prop_name, prop_def in schema.get("properties", {}).items():
        prop_type = type_map.get(
            prop_def.get("type", "string"),
            genai.protos.Type.STRING,
        )
        properties[prop_name] = genai.protos.Schema(
            type_=prop_type,
            description=prop_def.get("description", ""),
        )

    return genai.protos.Schema(
        type_=genai.protos.Type.OBJECT,
        properties=properties,
        required=schema.get("required", []),
    )
