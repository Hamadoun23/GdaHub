#!/bin/sh
# Demarrage du service financerh en developpement.
set -e

echo "[financerh] migrations"
python manage.py migrate --noinput

echo "[financerh] demarrage"
exec python manage.py runserver 0.0.0.0:8000
