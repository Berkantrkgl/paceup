#!/usr/bin/env bash
set -e

echo "[entrypoint] Running migrations..."
python manage.py migrate --noinput

echo "[entrypoint] Collecting static files..."
python manage.py collectstatic --noinput

echo "[entrypoint] Registering periodic tasks..."
python manage.py setup_periodic_tasks || echo "[entrypoint] setup_periodic_tasks skipped"

echo "[entrypoint] Starting: $*"
exec "$@"
