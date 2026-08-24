"""Reglages du service direction — Direction.

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

GDAHUB_APPLICATION = "direction"

INSTALLED_APPS = [*INSTALLED_APPS, "gdahub_common.validation", "direction"]

MEDIA_ROOT = BASE_DIR / "media"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Les services que celui-ci a le droit d'appeler, via gdahub_common.client.
# Direction est le seul service qui en appelle plusieurs : c'est son metier
# de rassembler. Chaque appel part avec le jeton du directeur, jamais avec un
# secret de service.
GDAHUB_SERVICES: dict[str, str] = {
    "organisation": os.environ.get(
        "GDAHUB_SERVICE_ORGANISATION", "http://organisation:8000"
    ),
    "rh": os.environ.get("GDAHUB_SERVICE_RH", "http://rh:8000"),
    "finance": os.environ.get("GDAHUB_SERVICE_FINANCE", "http://finance:8000"),
}
