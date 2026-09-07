import json

from django.core.cache import cache
from django.core.management.base import BaseCommand

from volcanai.ai_chat.utils import get_all_tools_for_gemini, select_tools_for_prompt

DEFAULT_PROBES = [
    "review my pull request",
    "send an email to the team",
    "search the web for latest Django release",
    "create a new file called notes.txt",
    "delete the old log file",
    "read my calendar for today",
    "setup the project scaffold",
    "zzz completely unrelated xyz",
    "a the for my me",
    "setup project #1",
    "setu- #22",
    "review ",
    "rev #22",
]

TYPE_NAMES = {
    1: "STRING",
    2: "NUMBER",
    3: "INTEGER",
    4: "BOOLEAN",
    5: "ARRAY",
    6: "OBJECT",
}


def clean_schema(schema):
    if not schema:
        return {}
    raw = type(schema).to_dict(schema) if hasattr(type(schema), "to_dict") else schema

    def _clean(node):
        if not isinstance(node, dict):
            return node
        res = {}
        if node.get("type_"):
            t_val = node["type_"]
            res["type"] = TYPE_NAMES.get(t_val, str(t_val))
        elif node.get("type"):
            res["type"] = node["type"]
        if node.get("description"):
            res["description"] = node["description"]
        if node.get("properties"):
            res["properties"] = {k: _clean(v) for k, v in node["properties"].items()}
        if node.get("required"):
            res["required"] = node["required"]
        if node.get("enum"):
            res["enum"] = node["enum"]
        if node.get("items"):
            res["items"] = _clean(node["items"])
        return res

    return _clean(raw)


class Command(BaseCommand):
    help = "Live-test select_tools_for_prompt against real MCP tools (no mocks)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--prompt",
            dest="prompts",
            action="append",
            metavar="PROMPT",
            help="Extra prompt to probe (can be repeated).",
        )
        parser.add_argument(
            "--top-n",
            type=int,
            default=2,
            help="top_n passed to select_tools_for_prompt (default: 2).",
        )
        parser.add_argument(
            "--no-cache",
            action="store_true",
            help="Bust the MCP tools cache before running.",
        )
        parser.add_argument(
            "--show-schema",
            "--schema",
            action="store_true",
            dest="show_schema",
            help="Display the input schema for each tool in output.",
        )

    def handle(self, *args, **options):
        if options["no_cache"]:
            cache.delete("mcp_tools_cache")
            cache.delete("mcp_tools_ui_cache")
            self.stdout.write(self.style.WARNING("Cache cleared.\n"))

        self.stdout.write(self.style.MIGRATE_HEADING("Fetching tools from MCP …"))
        all_gemini_tools, _, keyword_index = get_all_tools_for_gemini()

        if not all_gemini_tools:
            self.stderr.write(
                self.style.ERROR(
                    "No tools returned from MCP. "
                    "Is the MCP server running? Try `manage.py reboot_tools` first."
                )
            )
            return

        tool_count = len(all_gemini_tools)
        self.stdout.write(self.style.SUCCESS(f"  {tool_count} tool(s) available:\n"))
        for tool in all_gemini_tools:
            fn = tool.function_declarations[0]
            name = fn.name
            kws = keyword_index.get(name, set())
            self.stdout.write(f"    • {name}")
            self.stdout.write(self.style.HTTP_INFO(f"      keywords: {', '.join(sorted(kws))}"))
            if options["show_schema"]:
                schema_dict = clean_schema(fn.parameters)
                schema_str = json.dumps(schema_dict, indent=8)
                self.stdout.write(self.style.NOTICE(f"      schema:\n{schema_str}"))
            self.stdout.write("")

        probes = list(DEFAULT_PROBES)
        if options["prompts"]:
            probes += options["prompts"]

        top_n = options["top_n"]

        self.stdout.write(
            self.style.MIGRATE_HEADING(f"\nRunning {len(probes)} probe(s)  [top_n={top_n}]\n")
        )

        passed = failed = 0

        for prompt in probes:
            selected_tools, selected_router = select_tools_for_prompt(prompt, top_n=top_n)
            selected_names = [t.function_declarations[0].name for t in selected_tools]
            is_fallback = len(selected_names) == tool_count

            if is_fallback:
                status_tag = self.style.WARNING("FALLBACK")
            else:
                status_tag = self.style.SUCCESS("SELECTED")

            self.stdout.write(f'  prompt : "{prompt}"')
            self.stdout.write(f"  result : {status_tag}  {selected_names}")

            router_keys = set(selected_router.keys())
            names_set = set(selected_names)

            if router_keys == names_set:
                self.stdout.write(self.style.SUCCESS("  router : ✓ consistent\n"))
                passed += 1
            else:
                self.stdout.write(
                    self.style.ERROR(
                        f"  router : ✗ mismatch — "
                        f"extra={router_keys - names_set}  "
                        f"missing={names_set - router_keys}\n"
                    )
                )
                failed += 1

        self.stdout.write(self.style.MIGRATE_HEADING("Summary"))
        self.stdout.write(self.style.SUCCESS(f"  passed : {passed}"))
        if failed:
            self.stdout.write(self.style.ERROR(f"  failed : {failed}"))
        else:
            self.stdout.write(self.style.SUCCESS("  failed : 0  — all router checks clean ✓"))
