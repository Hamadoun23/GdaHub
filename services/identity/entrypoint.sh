#!/bin/sh
# Demarrage du service identity en developpement.
#
# Trois etapes, dans cet ordre : la paire de cles RSA (sans elle aucun jeton
# n'est signable), le schema, puis le jeu de donnees minimal — les quatre
# applications de GDA Hub et un compte administrateur.
set -e

echo "[identity] cles de signature"
python manage.py generer_cles

echo "[identity] migrations"
python manage.py migrate --noinput

echo "[identity] donnees de depart"
python manage.py amorcer

echo "[identity] demarrage"
exec python manage.py runserver 0.0.0.0:8000
