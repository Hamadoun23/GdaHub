#!/bin/sh
# Demarrage du service finance en developpement.
#
# `makemigrations` figure ici tant que le schema du domaine bouge a chaque
# seance. A remplacer par des migrations versionnees avant toute mise en
# service : une image de production ne genere pas son schema au demarrage.
set -e

echo "[finance] migrations"
python manage.py makemigrations finance --noinput
python manage.py migrate --noinput

echo "[finance] referentiels"
python manage.py amorcer

echo "[finance] circuits de validation"
python manage.py amorcer_circuits

echo "[finance] demarrage"
exec python manage.py runserver 0.0.0.0:8000
