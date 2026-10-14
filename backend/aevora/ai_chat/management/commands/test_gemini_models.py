import time

import google.generativeai as genai
from django.conf import settings
from django.core.management.base import BaseCommand

from aevora.ai_chat.models import AIModel


class Command(BaseCommand):
    help = "Test available Gemini models by sending a live prompt and recording performance."

    def add_arguments(self, parser):
        parser.add_argument(
            "--prompt",
            type=str,
            default="Reply with 'MODEL_NAME is active' in 5 words or less.",
            help="Prompt to test each model with.",
        )
        parser.add_argument(
            "--timeout",
            type=int,
            default=10,
            help="Per-model request timeout in seconds (default: 10).",
        )
        parser.add_argument(
            "--sync-db",
            action="store_true",
            help="Clean database to only retain verified working models.",
        )

    def handle(self, *args, **options):
        prompt = options["prompt"]
        timeout_sec = options["timeout"]
        sync_db = options["sync_db"]

        api_key = getattr(settings, "GEMINI_API_KEY", "")
        if not api_key:
            self.stdout.write(self.style.ERROR("GEMINI_API_KEY is not configured in settings."))
            return

        genai.configure(api_key=api_key)

        db_models = list(AIModel.objects.all().values_list("name", flat=True))

        lite_models = [
            "gemini-3.5-flash-lite",
            "gemini-2.5-flash-lite",
            "gemini-flash-lite-latest",
            "gemini-3.1-flash-lite",
            "gemini-3.1-flash-lite-preview",
        ]

        # Combine all unique models to test, ensuring flash-lite variants are prioritized
        all_models = list(dict.fromkeys(lite_models + db_models))

        self.stdout.write(
            self.style.MIGRATE_HEADING(
                f'\nTesting {len(all_models)} Gemini model(s) with prompt: "{prompt}" (timeout: {timeout_sec}s)\n'
            )
        )

        results = []
        working_models = []

        for model_name in all_models:
            start_time = time.time()
            try:
                model = genai.GenerativeModel(model_name=model_name)
                res = model.generate_content(
                    prompt,
                    request_options={"timeout": timeout_sec},
                )
                duration_ms = round((time.time() - start_time) * 1000)
                output_text = res.text.strip().replace("\n", " ") if hasattr(res, "text") else "OK"
                results.append(
                    {
                        "name": model_name,
                        "status": "WORKING",
                        "latency": duration_ms,
                        "note": output_text[:50],
                    }
                )
                working_models.append(model_name)
                self.stdout.write(
                    self.style.SUCCESS(
                        f'  [PASS] {model_name:32} | {duration_ms:5}ms | "{output_text[:50]}"'
                    )
                )
            except Exception as exc:  # noqa: BLE001
                duration_ms = round((time.time() - start_time) * 1000)
                err_str = str(exc).replace("\n", " ")
                if "429" in err_str or "quota" in err_str.lower():
                    status_label = "QUOTA_LIMITED (PAID TIER)"
                    note = "Requires paid tier or separate billing"
                elif "504" in err_str or "Deadline" in err_str:
                    status_label = "TIMEOUT (504)"
                    note = f"Deadline expired after {timeout_sec}s"
                elif "404" in err_str or "not found" in err_str.lower():
                    status_label = "NOT_FOUND (404)"
                    note = "Model endpoint deprecated or unavailable"
                else:
                    status_label = "FAILED"
                    note = err_str[:60]

                results.append(
                    {
                        "name": model_name,
                        "status": status_label,
                        "latency": duration_ms,
                        "note": note,
                    }
                )
                self.stdout.write(
                    self.style.WARNING(
                        f"  [FAIL] {model_name:32} | {duration_ms:5}ms | {status_label}: {note}"
                    )
                )

        self.stdout.write(self.style.MIGRATE_HEADING("\n=== MODEL TEST SUMMARY ==="))
        self.stdout.write(
            f"Total tested: {len(results)} | Working: {len(working_models)} | Failed: {len(results) - len(working_models)}"
        )

        if sync_db and working_models:
            self.stdout.write(
                self.style.MIGRATE_HEADING("\nSynchronizing AIModel database table...")
            )
            for m in working_models:
                AIModel.objects.get_or_create(name=m)
            # Remove non-working models from DB
            deleted, _ = AIModel.objects.exclude(name__in=working_models).delete()
            self.stdout.write(
                self.style.SUCCESS(
                    f"Database updated. Retained {len(working_models)} working model(s), removed {deleted} non-working model(s)."
                )
            )
