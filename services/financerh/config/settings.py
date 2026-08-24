"""Reglages du service financerh — RH & Finance.

Tout ce qui est commun a GDA Hub vient de gdahub_common.reglages : base de
donnees, authentification par jeton, format d'erreur, pagination, langue.
Ce fichier ne declare que ce qui appartient a ce service.

Ce service ne connait aucun utilisateur : il lit l'identite dans le jeton
signe par identity, et ne stocke a cote de ses donnees que des identifiants
numeriques, jamais de cle etrangere vers un autre service.
"""

from pathlib import Path

from gdahub_common.reglages import *  # noqa: F403
from gdahub_common.reglages import INSTALLED_APPS

BASE_DIR = Path(__file__).resolve().parent.parent

GDAHUB_APPLICATION = "financerh"

INSTALLED_APPS = [*INSTALLED_APPS, "rhfinance"]

MEDIA_ROOT = BASE_DIR / "media"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Les services que celui-ci a le droit d'appeler, via gdahub_common.client.
# Tant que la liste est vide, il est autonome — c'est l'objectif.
GDAHUB_SERVICES: dict[str, str] = {}
