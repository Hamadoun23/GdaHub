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
# `makemigrations` figure ici tant que le schema bouge a chaque seance.
# A retirer et a remplacer par des migrations versionnees avant toute
# mise en service : une image de production ne genere pas son schema.
python manage.py makemigrations comptes --noinput
python manage.py migrate --noinput

echo "[identity] donnees de depart"
python manage.py amorcer

# Confort de developpement : l'ERP demarre avec un effectif a l'ecran plutot
# qu'un annuaire vide. Idempotent, et sans effet sur les mots de passe deja
# personnalises. A retirer d'une image de production, ou l'import est une
# operation decidee.
echo "[identity] comptes de l'effectif"
python manage.py importer_comptes

echo "[identity] demarrage"
exec python manage.py runserver 0.0.0.0:8000
