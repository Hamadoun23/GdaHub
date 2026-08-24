#!/bin/sh
# Demarrage du service finance en developpement.
#
# `makemigrations` figure ici tant que le domaine n'est pas porte : le module
# n'a pas encore de modele, et les migrations seront versionnees avec eux.
# A retirer des que le domaine existe — une image de production ne genere pas
# ses migrations au demarrage.
set -e

echo "[finance] migrations"
python manage.py makemigrations finance --noinput
python manage.py migrate --noinput

echo "[finance] demarrage"
exec python manage.py runserver 0.0.0.0:8000
