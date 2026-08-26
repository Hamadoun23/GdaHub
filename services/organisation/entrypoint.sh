#!/bin/sh
# Demarrage du service organisation en developpement.
#
# Les migrations sont versionnees dans le depot : le demarrage se contente
# de les appliquer. Une image de production ne genere pas son schema, et un
# `makemigrations` au demarrage masquerait un modele modifie sans migration.
set -e

echo "[organisation] migrations"
python manage.py migrate --noinput

echo "[organisation] effectif"
python manage.py importer_effectif

echo "[organisation] demarrage"
exec python manage.py runserver 0.0.0.0:8000
