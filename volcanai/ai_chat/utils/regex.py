import re

STOPWORDS = frozenset(
    {
        "a",
        "an",
        "the",
        "to",
        "for",
        "in",
        "on",
        "of",
        "and",
        "or",
        "is",
        "it",
        "my",
        "me",
        "i",
        "with",
        "about",
        "can",
        "you",
        "this",
        "that",
        "please",
    }
)


def extract_words(text: str) -> set[str]:
    if not text:
        return set()
    return set(re.findall(r"[a-zA-Z0-9]+", text.lower()))


def extract_prompt_words(prompt: str) -> set[str]:
    raw_tokens = extract_words(prompt)
    return {w for w in (raw_tokens - STOPWORDS) if not w.isdigit()}


def is_prefix_match(word1: str, word2: str, min_length: int = 3) -> bool:
    if len(word1) < min_length or len(word2) < min_length:
        return False
    return word1.startswith(word2) or word2.startswith(word1)
