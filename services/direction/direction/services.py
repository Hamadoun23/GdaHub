"""La consolidation, seule vraie tache de ce service.

Direction ne detient pas les chiffres : elle les rassemble. Chaque appel part
avec **le jeton du directeur**, ce qui a deux consequences heureuses :

- aucune authentification de service a inventer ni a proteger ;
- un directeur ne voit dans la consolidation que ce qu'il verrait en ouvrant
  chaque application — le cloisonnement tient sans qu'on ait a le reecrire ici.

Un service injoignable n'interrompt pas la consolidation : sa case porte le
motif de l'echec. Un tableau de bord qui refuse de s'afficher parce qu'un
domaine sur cinq ne repond pas est moins utile qu'un tableau de bord honnete.
"""

from __future__ import annotations

import logging

from django.conf import settings
from gdahub_common.client import ClientService, ErreurService

journal = logging.getLogger("gdahub")

#: Les applications consolidees, et la route qui livre leurs indicateurs.
SOURCES = {
    "rh": ("Ressources humaines", "/api/rh/tableau-de-bord"),
    "finance": ("Finance", "/api/finance/tableau-de-bord"),
}


def consolider(utilisateur) -> dict:
    """Les indicateurs de chaque application, rassembles."""
    resultat = {}
    for code, (libelle, route) in SOURCES.items():
        resultat[code] = {"libelle": libelle, **_interroger(code, route, utilisateur)}
    return resultat


def _interroger(code: str, route: str, utilisateur) -> dict:
    if code not in getattr(settings, "GDAHUB_SERVICES", {}):
        return {"disponible": False, "motif": "Service non declare."}
    try:
        client = ClientService(code, jeton=utilisateur.jeton)
        return {"disponible": True, "indicateurs": client.get(route)}
    except ErreurService as erreur:
        journal.warning("Consolidation de %s impossible : %s", code, erreur)
        motif = (
            "Vous n'etes pas habilite sur cette application."
            if erreur.statut in {401, 403}
            else "Service momentanement indisponible."
        )
        return {"disponible": False, "motif": motif}


def circuits_de(application: str, utilisateur) -> dict:
    """Les regles de circuit d'une application, lues chez elle.

    C'est la console de parametrage : la direction consulte et modifie les
    circuits de chaque service a travers son API, avec ses propres droits.
    """
    if application not in SOURCES:
        return {"disponible": False, "motif": f"Application inconnue : {application}."}
    try:
        client = ClientService(application, jeton=utilisateur.jeton)
        return {
            "disponible": True,
            "regles": client.get(f"/api/{application}/circuits", {"taille": 200}),
        }
    except ErreurService as erreur:
        journal.warning("Circuits de %s illisibles : %s", application, erreur)
        return {"disponible": False, "motif": str(erreur)}


def files_d_attente(utilisateur) -> dict:
    """Ce qui attend une decision du directeur, application par application.

    Le nombre suffit ici : la file elle-meme se consulte dans l'application
    concernee, ou l'on dispose du dossier complet pour trancher.
    """
    routes = {
        "rh": "/api/rh/demandes-absence/a-valider",
        "finance": "/api/finance/depenses/a-valider",
    }
    resultat = {}
    for code, route in routes.items():
        if code not in getattr(settings, "GDAHUB_SERVICES", {}):
            resultat[code] = {"disponible": False, "motif": "Service non declare."}
            continue
        try:
            client = ClientService(code, jeton=utilisateur.jeton)
            page = client.get(route, {"taille": 1})
            resultat[code] = {"disponible": True, "en_attente": page.get("total", 0)}
        except ErreurService as erreur:
            journal.warning("File de %s illisible : %s", code, erreur)
            resultat[code] = {"disponible": False, "motif": "Service indisponible."}
    return resultat
