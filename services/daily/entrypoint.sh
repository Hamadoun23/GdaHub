#!/bin/sh
# Demarrage du service daily en developpement.
set -e

echo "[daily] migrations"
python manage.py migrate --noinput

echo "[daily] demarrage"
exec python manage.py runserver 0.0.0.0:8000
