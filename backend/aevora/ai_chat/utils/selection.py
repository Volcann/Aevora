from django.core.cache import cache

from aevora.ai_chat.utils.regex import (
    extract_prompt_words,
    extract_words,
    is_prefix_match,
)
from aevora.ai_chat.utils.tools import get_all_tools_for_gemini


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
