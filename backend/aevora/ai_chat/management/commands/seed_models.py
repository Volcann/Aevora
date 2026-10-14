from decimal import Decimal

from django.core.management.base import BaseCommand

from aevora.ai_chat.models import AIModel


class Command(BaseCommand):
    help = "Seed verified responsive Gemini models and delete unresponsive/deprecated models."

    def add_arguments(self, parser):
        parser.add_argument(
            "--keep-all",
            action="store_true",
            help="Do not delete models outside the verified responsive list.",
        )

    def handle(self, *args, **options):
        keep_all = options.get("keep_all", False)

        # Verified responsive, free-tier accessible models tested with live prompts
        responsive_models = [
            {"name": "gemini-3.5-flash-lite", "quota": Decimal("300.00")},
            {"name": "gemini-2.5-flash-lite", "quota": Decimal("250.00")},
            {"name": "gemini-2.5-flash", "quota": Decimal("200.00")},
            {"name": "gemini-flash-lite-latest", "quota": Decimal("300.00")},
            {"name": "gemini-3.1-flash-lite", "quota": Decimal("250.00")},
            {"name": "gemini-3.1-flash-lite-preview", "quota": Decimal("250.00")},
        ]

        self.stdout.write(
            self.style.MIGRATE_HEADING("Seeding verified responsive Gemini models...")
        )

        created_count = 0
        updated_count = 0
        for item in responsive_models:
            model_obj, created = AIModel.objects.get_or_create(
                name=item["name"],
                defaults={"quota": item["quota"]},
            )
            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f"  + Created AIModel: {model_obj.name} (quota: {model_obj.quota})"
                    )
                )
            else:
                updated_count += 1
                self.stdout.write(
                    f"  = AIModel '{model_obj.name}' exists (quota: {model_obj.quota})."
                )

        # Delete unresponsive, quota-exceeded (paid only), or timed-out models
        deleted_count = 0
        if not keep_all:
            active_names = [item["name"] for item in responsive_models]
            deleted_count, _ = AIModel.objects.exclude(name__in=active_names).delete()
            if deleted_count:
                self.stdout.write(
                    self.style.WARNING(
                        f"  - Deleted {deleted_count} unresponsive/unsupported model(s) from database."
                    )
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeding completed successfully: {created_count} added, {updated_count} verified, {deleted_count} unresponsive deleted."
            )
        )
