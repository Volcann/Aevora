import json

import google.generativeai as genai
from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from django.shortcuts import get_object_or_404

from aevora.ai_chat.choices import MessageRole
from aevora.ai_chat.models import AIModel, Message


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


def get_history(session, limit=5):
    prior = list(
        Message.objects.filter(
            session=session,
            role=MessageRole.MODEL,
        ).order_by("created_at")
    )
    if limit is not None:
        prior = prior[-limit:]

    history = [
        {
            "role": ("user" if message.role == MessageRole.USER else MessageRole.MODEL),
            "parts": [message.content],
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

        # gemini_tools, _tool_router = select_tools_for_prompt(prompt)
        # model_kwargs = {"tools": gemini_tools}
        model_kwargs = {}

        try:
            genai_model = genai.GenerativeModel(
                model_name=model.name if model else "gemini-3.5-flash-lite",
                **model_kwargs,
            )
            chat = genai_model.start_chat(history=history)
        except Exception:  # noqa: BLE001
            genai_model = genai.GenerativeModel(
                model_name="gemini-3.5-flash-lite",
                **model_kwargs,
            )
            chat = genai_model.start_chat(history=history)

        full_text = []
        for chunk in chat.send_message(prompt, stream=True):
            if chunk.text:
                full_text.append(chunk.text)
                yield _sse({"type": "chunk", "text": chunk.text})

        Message.objects.create(
            session=session,
            role=MessageRole.USER,
            content=prompt,
            model=model,
        )
        Message.objects.create(
            session=session,
            role=MessageRole.MODEL,
            content="".join(full_text),
            model=model,
        )
        yield _sse({"type": "done"})

    except Exception as exc:  # noqa: BLE001
        yield _sse({"type": "chunk", "text": f"\n\n⚠ Error: {exc}"})
