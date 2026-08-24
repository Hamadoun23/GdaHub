#!/bin/sh
# Demarrage du service orange en developpement.
set -e

echo "[orange] migrations"
python manage.py migrate --noinput

echo "[orange] demarrage"
exec python manage.py runserver 0.0.0.0:8000
