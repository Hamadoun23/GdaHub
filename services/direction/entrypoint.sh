#!/bin/sh
# Demarrage du service direction en developpement.
#
# `makemigrations` figure ici tant que le schema du domaine bouge a chaque
# seance. A remplacer par des migrations versionnees avant toute mise en
# service : une image de production ne genere pas son schema au demarrage.
set -e

echo "[direction] migrations"
python manage.py makemigrations direction --noinput
python manage.py migrate --noinput

echo "[direction] demarrage"
exec python manage.py runserver 0.0.0.0:8000
