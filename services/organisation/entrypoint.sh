#!/bin/sh
# Demarrage du service organisation en developpement.
#
# `makemigrations` figure ici tant que le schema du domaine bouge a chaque
# seance. A remplacer par des migrations versionnees avant toute mise en
# service : une image de production ne genere pas son schema au demarrage.
set -e

echo "[organisation] migrations"
python manage.py makemigrations organisation --noinput
python manage.py migrate --noinput

echo "[organisation] effectif"
python manage.py importer_effectif

echo "[organisation] demarrage"
exec python manage.py runserver 0.0.0.0:8000
