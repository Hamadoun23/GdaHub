#!/bin/sh
# Demarrage du service planning en developpement.
set -e

echo "[planning] migrations"
python manage.py migrate --noinput

echo "[planning] demarrage"
exec python manage.py runserver 0.0.0.0:8000
