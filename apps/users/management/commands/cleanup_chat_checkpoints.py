"""
LangGraph AsyncPostgresSaver tablolarındaki eski checkpoint kayıtlarını siler.

Spark AI sohbetlerinin chat history'sini uzun süreli tutmuyoruz; HITL akışı
için 7 gün yeterli. Bundan eski thread'leri silmek hem gizliliği korur hem
DB disk kullanımını sabit tutar (özellikle Aiven Developer 8GB sınırında).

Kullanım:
    python manage.py cleanup_chat_checkpoints
    python manage.py cleanup_chat_checkpoints --days 14
"""

from django.core.management.base import BaseCommand
from django.db import connection


CHECKPOINT_TABLES = ["checkpoints", "checkpoint_writes", "checkpoint_blobs"]


class Command(BaseCommand):
    help = "LangGraph checkpoint tablolarındaki eski kayıtları siler"

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=7,
            help="Kaç günden eski kayıtlar silinsin (default: 7)",
        )

    def handle(self, *args, **options):
        days = options["days"]
        total_deleted = 0

        with connection.cursor() as cursor:
            for table in CHECKPOINT_TABLES:
                cursor.execute(
                    "SELECT to_regclass(%s) IS NOT NULL", [f"public.{table}"]
                )
                exists = cursor.fetchone()[0]
                if not exists:
                    self.stdout.write(
                        self.style.WARNING(f"⚠ '{table}' tablosu yok, atlanıyor")
                    )
                    continue

                # AsyncPostgresSaver tablolarında created_at kolonu yok;
                # checkpoint_id (TEXT) bir UUIDv7-benzeri timestamp içerir ama
                # güvenli yol thread_id bazlı temizlik. Pratik yaklaşım:
                # checkpoint_writes ve checkpoint_blobs'ı checkpoints'tan
                # silinen thread'lere göre temizle.
                if table == "checkpoints":
                    # checkpoints.checkpoint sütunu JSONB; ts alanı var
                    cursor.execute(
                        f"""
                        DELETE FROM {table}
                        WHERE thread_id IN (
                            SELECT thread_id FROM {table}
                            GROUP BY thread_id
                            HAVING MAX((checkpoint->>'ts')::timestamptz)
                                   < NOW() - INTERVAL '%s days'
                        )
                        """ % days
                    )
                else:
                    cursor.execute(
                        f"""
                        DELETE FROM {table}
                        WHERE thread_id NOT IN (
                            SELECT DISTINCT thread_id FROM checkpoints
                        )
                        """
                    )

                deleted = cursor.rowcount
                total_deleted += deleted
                self.stdout.write(
                    self.style.SUCCESS(
                        f"✓ '{table}': {deleted} satır silindi"
                    )
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"\nToplam {total_deleted} satır silindi "
                f"({days} günden eski)"
            )
        )
