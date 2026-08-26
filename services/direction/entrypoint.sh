#!/bin/sh
# Demarrage du service direction en developpement.
#
# Les migrations sont versionnees dans le depot : le demarrage se contente
# de les appliquer. Une image de production ne genere pas son schema, et un
# `makemigrations` au demarrage masquerait un modele modifie sans migration.
set -e

echo "[direction] migrations"
python manage.py migrate --noinput

echo "[direction] demarrage"
exec python manage.py runserver 0.0.0.0:8000
