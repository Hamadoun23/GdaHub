#!/bin/sh
# Demarrage du service bdm en developpement.
set -e

echo "[bdm] migrations"
python manage.py migrate --noinput

echo "[bdm] demarrage"
exec python manage.py runserver 0.0.0.0:8000
