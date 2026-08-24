"""Regles metier des ressources humaines.

Les vues n'en portent aucune : elles lisent la requete, appellent d'ici, et
rendent la reponse.
"""

from __future__ import annotations

import re
import unicodedata
from datetime import timedelta
from decimal import Decimal

from rh.models import (
    CategorieAbsence,
    DemandeAbsence,
    Presence,
    SoldeConge,
    StatutPresence,
    TypeAbsence,
)

#: Jours accordes par defaut a un agent pour une annee civile.
JOURS_ACQUIS_PAR_DEFAUT = Decimal("30.0")


def solde_de(agent_identifiant: str, annee: int, instantane: dict | None = None):
    """Le solde de l'annee, cree au besoin.

    Un agent qui n'a jamais pose de conge n'a pas de ligne de solde : la creer
    a la lecture evite d'avoir a lancer une campagne d'initialisation chaque
    1er janvier.
    """
    solde, cree = SoldeConge.objects.get_or_create(
        agent_identifiant=agent_identifiant,
        annee=annee,
        defaults={"jours_acquis": JOURS_ACQUIS_PAR_DEFAUT},
    )
    if cree and instantane:
        solde.appliquer_agent(instantane)
        solde.save()
    return solde


def decompter_solde(demande: DemandeAbsence) -> SoldeConge:
    """Retire les jours accordes du solde du demandeur.

    Appele une seule fois, au terme du circuit. Le solde de l'annee retenue
    est celui de la date de debut : un conge a cheval sur le 31 decembre est
    impute sur l'annee ou il commence, comme le fait l'application d'origine.
    """
    solde = solde_de(
        demande.demandeur_identifiant,
        demande.date_debut.year,
        {
            "identifiant": demande.demandeur_identifiant,
            "agent_id": demande.demandeur_agent_id,
            "nom_complet": demande.demandeur_nom,
            "departement_id": demande.demandeur_departement_id,
            "departement_nom": demande.demandeur_departement_nom,
        },
    )
    solde.jours_pris += demande.nb_jours
    solde.save(update_fields=["jours_pris", "modifie_le"])
    return solde


def marquer_presences(demande: DemandeAbsence) -> int:
    """Inscrit l'absence approuvee au registre des presences.

    Un retard ne marque pas la journee : l'agent est venu. C'est la seule
    categorie qui ne produit aucune ligne de presence.
    """
    if demande.type_absence.categorie == CategorieAbsence.RETARD:
        return 0

    statut = (
        StatutPresence.CONGE
        if demande.type_absence.categorie == CategorieAbsence.CONGE
        else StatutPresence.ABSENT
    )
    instantane = {
        "identifiant": demande.demandeur_identifiant,
        "agent_id": demande.demandeur_agent_id,
        "nom_complet": demande.demandeur_nom,
        "departement_id": demande.demandeur_departement_id,
        "departement_nom": demande.demandeur_departement_nom,
    }

    jour = demande.date_debut
    marquees = 0
    while jour <= demande.date_fin:
        presence, _ = Presence.objects.update_or_create(
            agent_identifiant=demande.demandeur_identifiant,
            date=jour,
            defaults={
                "statut": statut,
                "commentaire": f"{demande.type_absence.libelle} ({demande.numero})",
            },
        )
        presence.appliquer_agent(instantane)
        presence.save()
        marquees += 1
        jour += timedelta(days=1)
    return marquees


def type_par_libelle(libelle: str) -> TypeAbsence | str:
    """Rend le type connu correspondant, sinon le libelle nettoye.

    La creation du type est repoussee au moment de l'enregistrement : la faire
    ici laisserait un type orphelin en base chaque fois qu'une autre regle du
    formulaire rejette la demande.
    """
    propre = " ".join(libelle.split())
    if not propre:
        return ""
    return TypeAbsence.objects.filter(libelle__iexact=propre).first() or propre


def materialiser_type(valeur) -> TypeAbsence:
    """Cree le type d'absence correspondant a un libelle inedit.

    Il n'entame pas le solde tant que les RH ne l'ont pas parametre : sur la
    foi d'un texte libre, on ne retire de jours a personne.
    """
    if isinstance(valeur, TypeAbsence):
        return valeur
    return TypeAbsence.objects.create(
        libelle=valeur,
        code=_code_disponible(valeur),
        categorie=CategorieAbsence.CONGE,
        decompte_solde=False,
    )


def _code_disponible(libelle: str) -> str:
    sans_accent = (
        unicodedata.normalize("NFKD", libelle).encode("ascii", "ignore").decode()
    )
    base = re.sub(r"[^A-Z0-9]", "", sans_accent.upper())[:12] or "ABS"
    code = base
    suffixe = 1
    while TypeAbsence.objects.filter(code=code).exists():
        suffixe += 1
        code = f"{base}{suffixe}"
    return code
