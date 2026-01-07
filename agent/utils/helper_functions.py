from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg_pool import AsyncConnectionPool
from dotenv import load_dotenv
import boto3
import os

load_dotenv(".env", override=True)

async def setup_postgres_connection():
    DB_URI = os.getenv("DB_URI")
    if not DB_URI:
        raise ValueError("DB_URI environment variable is not set")

    try:
        # Create the pool with more explicit error handling
        pool = AsyncConnectionPool(
            conninfo=DB_URI,
            max_size=20,
            kwargs={"autocommit": True, "prepare_threshold": 0},
            open=False,
        )

        # Open the pool with error handling
        try:
            await pool.open()
        except Exception as e:
            raise Exception(f"Failed to open connection pool: {str(e)}")

        # Create the saver
        memory = AsyncPostgresSaver(pool)

        # Setup with error handling
        try:
            await memory.setup()
        except Exception as e:
            if "already exists" in str(e):
                # If tables exist, we can continue
                pass
            else:
                raise Exception(f"Failed to setup PostgreSQL tables: {str(e)}")

        return memory, pool

    except Exception as e:
        raise Exception(f"Database initialization failed: {str(e)}")

async def check_thread_exists(pool, thread_id: str) -> bool:
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT EXISTS(
                    SELECT 1 
                    FROM checkpoints 
                    WHERE thread_id = %s
                    LIMIT 1
                )
                """,
                (thread_id,),
            )
            result = await cur.fetchone()
            return result[0] if result else False

