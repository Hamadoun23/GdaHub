"""Reglages du service finance — Finance.

Tout ce qui est commun a GDA Hub vient de gdahub_common.reglages : base de
donnees, authentification par jeton, format d'erreur, pagination, langue.
Ce fichier ne declare que ce qui appartient a ce service.

Ce service ne connait aucun utilisateur : il lit l'identite dans le jeton
signe par identity, et ne stocke a cote de ses donnees que des identifiants
numeriques, jamais de cle etrangere vers un autre service.
"""

import os
from pathlib import Path

from gdahub_common.reglages import *  # noqa: F403
from gdahub_common.reglages import INSTALLED_APPS

BASE_DIR = Path(__file__).resolve().parent.parent

GDAHUB_APPLICATION = "finance"

# `gdahub_common.validation` apporte le moteur de circuit et ses tables :
# chaque service porte les siennes, aucune decision ne traverse le reseau.
INSTALLED_APPS = [*INSTALLED_APPS, "gdahub_common.validation", "finance"]

MEDIA_ROOT = BASE_DIR / "media"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Les services que celui-ci a le droit d'appeler, via gdahub_common.client.
# Un seul service appele, et un seul appel : l'annuaire, au moment ou une
# demande est deposee. Tout le reste se lit en local.
GDAHUB_SERVICES: dict[str, str] = {
    "organisation": os.environ.get(
        "GDAHUB_SERVICE_ORGANISATION", "http://organisation:8000"
    ),
}
