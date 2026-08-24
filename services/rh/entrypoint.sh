#!/bin/sh
# Demarrage du service rh en developpement.
#
# `makemigrations` figure ici tant que le schema du domaine bouge a chaque
# seance. A remplacer par des migrations versionnees avant toute mise en
# service : une image de production ne genere pas son schema au demarrage.
set -e

echo "[rh] migrations"
python manage.py makemigrations rh --noinput
python manage.py migrate --noinput

echo "[rh] referentiels"
python manage.py amorcer

echo "[rh] circuits de validation"
python manage.py amorcer_circuits

echo "[rh] demarrage"
exec python manage.py runserver 0.0.0.0:8000
