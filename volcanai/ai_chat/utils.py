import json

import google.generativeai as genai
from django.conf import settings
from django.core.cache import cache
from django.core.exceptions import ValidationError

from volcanai.ai_chat.choices import MessageRole
from volcanai.ai_chat.models import ChatSession, Message, ServerConfig
from volcanai.ai_chat.regex_utils import extract_prompt_words, extract_words, is_prefix_match
from volcanai.ai_chat.services.mcp_manager import MCPClient


def cleanup_empty_sessions(user, exclude_session_id=None):
    if not user or not user.is_authenticated:
        return

    queryset = ChatSession.objects.filter(user=user).exclude(
        messages__role=MessageRole.AI_GENERATED
    )
    if exclude_session_id:
        queryset = queryset.exclude(id=exclude_session_id)
    queryset.delete()


def _sse(data):
    return f"data: {json.dumps(data)}\n\n"


def _gemini_stream(session, prompt):
    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)

        prior = list(
            Message.objects.filter(
                session=session,
                role=MessageRole.AI_GENERATED,
            ).order_by("created_at")
        )[-5:]

        history = [
            {
                "role": "user" if message.role == MessageRole.HUMAN else MessageRole.MODEL,
                "parts": [message.content],
            }
            for message in prior
        ]
        while history and history[0]["role"] != "user":
            history.pop(0)

        gemini_tools, tool_router = select_tools_for_prompt(prompt)
        model = genai.GenerativeModel(
            model_name=getattr(settings, "GEMINI_MODEL", "gemini-3.5-flash-lite"),
            tools=gemini_tools,
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


def _ensure_default_server_config():
    servers = ServerConfig.objects.filter(is_active=True)
    if not servers.exists():
        raise ValidationError(
            "No active ServerConfig found. Please run the management command 'python manage.py reboot_tools' to create one."
        )
    return servers


def get_available_tools_list(cache_seconds: int = 300) -> list[dict]:
    cached = cache.get("mcp_tools_ui_cache")
    if cached:
        return cached

    servers = _ensure_default_server_config()
    ui_tools = []

    for server in servers:
        try:
            client = MCPClient(server)
            tools = client.list_tools()

            for tool in tools:
                input_schema = tool.get("inputSchema", {})
                ui_tools.append(
                    {
                        "name": tool["name"],
                        "description": tool.get("description", ""),
                        "parameters": {
                            "properties": input_schema.get("properties", {}),
                            "required": input_schema.get("required", []),
                        },
                    }
                )
        except Exception as exc:  # noqa: BLE001
            print(f"[MCP] Could not reach server '{server.name}': {exc}")

    if ui_tools:
        cache.set("mcp_tools_ui_cache", ui_tools, cache_seconds)
    return ui_tools


def get_all_tools_for_gemini(cache_seconds: int = 300) -> tuple[list, dict, dict]:
    cached = cache.get("mcp_tools_cache")
    if cached and cached[0]:
        return cached

    servers = _ensure_default_server_config()

    gemini_tools = []
    tool_router = {}
    keyword_index = {}

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
                raw = tool["name"] + " " + tool.get("description", "")
                keyword_index[tool["name"]] = extract_words(raw)

        except Exception as exc:  # noqa: BLE001
            print(f"[MCP] Could not reach server '{server.name}': {exc}")

    if gemini_tools:
        cache.set("mcp_tools_cache", (gemini_tools, tool_router, keyword_index), cache_seconds)
    return gemini_tools, tool_router, keyword_index


def _get_tool_name(gemini_tool) -> str:
    return gemini_tool.function_declarations[0].name


def select_tools_for_prompt(prompt: str, top_n: int = 2) -> tuple[list, dict]:
    cached = cache.get("mcp_tools_cache")
    if not cached:
        all_gemini_tools, tool_router, keyword_index = get_all_tools_for_gemini()
    else:
        all_gemini_tools, tool_router, keyword_index = cached

    if not all_gemini_tools:
        return [], {}

    prompt_words = extract_prompt_words(prompt)
    if not prompt_words:
        return all_gemini_tools, tool_router

    scores = {}
    for name, all_kws in keyword_index.items():
        name_words = extract_words(name)
        desc_words = all_kws - name_words

        score = 0
        for pw in prompt_words:
            if pw in name_words:
                score += 3
            elif any(is_prefix_match(pw, nw) for nw in name_words):
                score += 2
            elif pw in desc_words or any(is_prefix_match(pw, dw) for dw in desc_words):
                score += 1

        scores[name] = score

    matched = {name: score for name, score in scores.items() if score > 0}
    if not matched:
        return all_gemini_tools, tool_router

    top_names = set(sorted(matched, key=matched.get, reverse=True)[:top_n])

    selected_tools = [t for t in all_gemini_tools if _get_tool_name(t) in top_names]
    selected_router = {k: v for k, v in tool_router.items() if k in top_names}
    return selected_tools, selected_router


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
