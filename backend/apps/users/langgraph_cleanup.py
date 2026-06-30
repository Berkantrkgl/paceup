"""LangGraph saver tablolarından user'a ait thread'leri silen helper.

LangGraph AsyncPostgresSaver şu tabloları kullanıyor:
- checkpoints
- checkpoint_blobs
- checkpoint_writes
- (checkpoint_migrations sadece schema state, dokunmuyoruz)

Hepsi thread_id kolonuna sahip. Hesap silinirken ilgili thread_id'ler bu
tablolardan raw SQL ile temizleniyor.
"""
import logging
from django.db import connection


logger = logging.getLogger(__name__)


# AsyncPostgresSaver'ın yarattığı tablolar. Schema değişirse buraya eklenir.
LANGGRAPH_TABLES = ("checkpoints", "checkpoint_blobs", "checkpoint_writes")


def delete_threads(thread_ids: list[str]) -> None:
    """Verilen thread_id'leri LangGraph tablolarından siler.

    LangGraph tabloları Django ORM'de tanımlı olmadığı için raw SQL kullanıyoruz.
    Tablo yoksa sessizce geçer (henüz hiç sohbet kullanılmamışsa tablo
    oluşmamış olabilir).
    """
    if not thread_ids:
        return

    with connection.cursor() as cur:
        for table in LANGGRAPH_TABLES:
            try:
                cur.execute(
                    f"DELETE FROM {table} WHERE thread_id = ANY(%s)",
                    [thread_ids],
                )
            except Exception as e:
                # Tablo yok veya başka bir hata — log'la, devam et.
                # Best-effort: ana hesap silme akışını bloklamaktan kaçınıyoruz.
                logger.warning(
                    "LangGraph cleanup failed for table %s: %s", table, e
                )
