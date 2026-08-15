from django.test import TestCase

from volcanai.ai_chat.utils.regex import (
    extract_prompt_words,
    extract_words,
    is_prefix_match,
)


class RegexTestCase(TestCase):
    def test_extract_words(self):
        self.assertEqual(extract_words("setu- #22"), {"setu", "22"})
        self.assertEqual(extract_words("hello_world! 123"), {"hello", "world", "123"})
        self.assertEqual(extract_words(""), set())

    def test_extract_prompt_words(self):
        self.assertEqual(extract_prompt_words("setu- #22"), {"setu"})
        self.assertEqual(
            extract_prompt_words("setup the project for me"), {"setup", "project"}
        )
        self.assertEqual(extract_prompt_words("a the to"), set())

    def test_is_prefix_match(self):
        self.assertTrue(is_prefix_match("setu", "setup"))
        self.assertTrue(is_prefix_match("setup", "setu"))
        self.assertFalse(is_prefix_match("pr", "project"))
        self.assertFalse(is_prefix_match("abc", "xyz"))
        self.assertFalse(is_prefix_match("ab", "abc"))
