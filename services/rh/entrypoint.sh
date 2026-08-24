#!/bin/sh
# Demarrage du service rh en developpement.
#
# `makemigrations` figure ici tant que le domaine n'est pas porte : le module
# n'a pas encore de modele, et les migrations seront versionnees avec eux.
# A retirer des que le domaine existe — une image de production ne genere pas
# ses migrations au demarrage.
set -e

echo "[rh] migrations"
python manage.py makemigrations rh --noinput
python manage.py migrate --noinput

echo "[rh] demarrage"
exec python manage.py runserver 0.0.0.0:8000
