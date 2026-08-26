#!/bin/sh
# Demarrage du service finance en developpement.
#
# Les migrations sont versionnees dans le depot : le demarrage se contente
# de les appliquer. Une image de production ne genere pas son schema, et un
# `makemigrations` au demarrage masquerait un modele modifie sans migration.
set -e

echo "[finance] migrations"
python manage.py migrate --noinput

echo "[finance] referentiels"
python manage.py amorcer

echo "[finance] circuits de validation"
python manage.py amorcer_circuits

echo "[finance] demarrage"
exec python manage.py runserver 0.0.0.0:8000
