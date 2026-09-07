#!/bin/bash
set -e

# Named volumes are root-owned by default; make them writable for django.
mkdir -p /app/staticfiles /app/media /app/logs
chown -R django:django /app/staticfiles /app/media /app/logs

exec runuser -u django -- "$@"
