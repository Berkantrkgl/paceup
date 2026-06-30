"""
Django-q2 Schedule tablosuna periyodik task'ları kaydeder.
Idempotent: birden fazla çalıştırıldığında aynı task'ı tekrar oluşturmaz.

Kullanım:
    python manage.py setup_periodic_tasks
"""

from django.core.management.base import BaseCommand
from django_q.models import Schedule


PERIODIC_TASKS = [
    {
        "name": "send_workout_reminders",
        "func": "apps.notifications.tasks.send_workout_reminders",
        "schedule_type": Schedule.CRON,
        "cron": "0 * * * *",  # her saat başı (xx:00)
    },
    {
        "name": "cleanup_chat_checkpoints",
        "func": "django.core.management.call_command",
        "args": "'cleanup_chat_checkpoints'",
        "schedule_type": Schedule.CRON,
        "cron": "0 3 * * *",  # her gece 03:00 UTC
    },
]


class Command(BaseCommand):
    help = "Periyodik task'ları django-q2 Schedule tablosuna kaydeder"

    def handle(self, *args, **options):
        for task in PERIODIC_TASKS:
            defaults = {
                "func": task["func"],
                "schedule_type": task["schedule_type"],
                "cron": task["cron"],
                "repeats": -1,  # sonsuz tekrar
            }
            if "args" in task:
                defaults["args"] = task["args"]
            obj, created = Schedule.objects.update_or_create(
                name=task["name"],
                defaults=defaults,
            )
            action = "oluşturuldu" if created else "güncellendi"
            self.stdout.write(
                self.style.SUCCESS(
                    f"✓ '{task['name']}' {action} (cron: {task['cron']})"
                )
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"\nToplam {len(PERIODIC_TASKS)} task kuruldu."
            )
        )
        self.stdout.write(
            "Worker'ı başlatmak için: python manage.py qcluster"
        )
