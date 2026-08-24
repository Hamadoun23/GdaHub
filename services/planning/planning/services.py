"""Regles metier du planning editorial."""

from __future__ import annotations

from calendar import monthrange
from datetime import date

from django.db.models import Count, Q
from django.utils import timezone

from planning.models import (
    Client,
    Publication,
    StatutEcheance,
    Tournage,
)

MOIS = [
    "Janvier",
    "Fevrier",
    "Mars",
    "Avril",
    "Mai",
    "Juin",
    "Juillet",
    "Aout",
    "Septembre",
    "Octobre",
    "Novembre",
    "Decembre",
]


def nom_du_mois(mois: int) -> str:
    return MOIS[mois - 1] if 1 <= mois <= 12 else f"Mois {mois}"


def bornes_du_mois(mois: int, annee: int) -> tuple[date, date]:
    return date(annee, mois, 1), date(annee, mois, monthrange(annee, mois)[1])


def clients_visibles(queryset, utilisateur):
    """Un client ne voit que son propre planning.

    C'est la regle de confidentialite du domaine : deux clients de GDA sont
    souvent concurrents, et l'un ne doit rien apprendre du calendrier de
    l'autre.
    """
    if utilisateur.est_superadmin or utilisateur.a_role("admin", "team"):
        return queryset
    return queryset.filter(compte_identifiant=utilisateur.identifiant)


def filtrer_pour(queryset, utilisateur):
    """Le meme cloisonnement, applique aux tournages et aux publications."""
    if utilisateur.est_superadmin or utilisateur.a_role("admin", "team"):
        return queryset
    return queryset.filter(client__compte_identifiant=utilisateur.identifiant)


def statistiques(client: Client, mois: int, annee: int) -> dict:
    """Le bilan d'un client pour un mois, en deux requetes.

    La version d'origine en lancait une douzaine — une par compteur. Sur une
    page qui affiche dix clients, cela faisait cent vingt requetes pour un
    tableau de bord.
    """
    debut, fin = bornes_du_mois(mois, annee)
    aujourdhui = timezone.localdate()

    def compter(modele):
        agregats = modele.objects.filter(
            client=client, date__gte=debut, date__lte=fin
        ).aggregate(
            total=Count("id"),
            en_attente=Count("id", filter=Q(statut=StatutEcheance.EN_ATTENTE)),
            realises=Count("id", filter=Q(statut=StatutEcheance.REALISE)),
            annules=Count("id", filter=Q(statut=StatutEcheance.ANNULE)),
            en_retard=Count(
                "id",
                filter=Q(statut=StatutEcheance.EN_ATTENTE, date__lt=aujourdhui),
            ),
        )
        return agregats

    return {
        "mois": mois,
        "annee": annee,
        "mois_libelle": nom_du_mois(mois),
        "tournages": compter(Tournage),
        "publications": compter(Publication),
        "regles": client.regles.count(),
    }


def calendrier(mois: int, annee: int, utilisateur, client_id: int | None = None) -> dict:
    """Tout ce qu'il y a a faire ce mois-ci, jour par jour.

    Une seule route pour l'ecran principal : le planning se lit en grille, et
    le construire par appels successifs le ferait s'afficher par morceaux.
    """
    debut, fin = bornes_du_mois(mois, annee)

    tournages = filtrer_pour(
        Tournage.objects.filter(date__gte=debut, date__lte=fin).select_related("client"),
        utilisateur,
    )
    publications = filtrer_pour(
        Publication.objects.filter(date__gte=debut, date__lte=fin).select_related(
            "client", "idee", "tournage"
        ),
        utilisateur,
    )
    if client_id:
        tournages = tournages.filter(client_id=client_id)
        publications = publications.filter(client_id=client_id)

    jours: dict[str, dict] = {}
    for tournage in tournages:
        entree = jours.setdefault(
            tournage.date.isoformat(), {"tournages": [], "publications": []}
        )
        entree["tournages"].append(
            {
                "id": tournage.pk,
                "client": tournage.client.nom_entreprise,
                "statut": tournage.statut,
                "en_retard": tournage.en_retard,
                "description": tournage.description,
            }
        )
    for publication in publications:
        entree = jours.setdefault(
            publication.date.isoformat(), {"tournages": [], "publications": []}
        )
        entree["publications"].append(
            {
                "id": publication.pk,
                "client": publication.client.nom_entreprise,
                "statut": publication.statut,
                "en_retard": publication.en_retard,
                "jour_deconseille": publication.jour_deconseille,
                "idee": publication.idee.titre if publication.idee else "",
            }
        )

    return {
        "mois": mois,
        "annee": annee,
        "mois_libelle": nom_du_mois(mois),
        "debut": debut,
        "fin": fin,
        "jours": jours,
    }


def construire_rapport(client: Client, mois: int, annee: int, utilisateur):
    """Fige le bilan du mois pour ce client.

    Le contenu est enregistre tel quel : un rapport deja remis ne doit pas
    changer parce qu'une publication a ete corrigee depuis.
    """
    from planning.models import RapportClient

    indicateurs = statistiques(client, mois, annee)
    rapport, _ = RapportClient.objects.update_or_create(
        client=client,
        mois=mois,
        annee=annee,
        defaults={
            "indicateurs": indicateurs,
            "genere_par_identifiant": utilisateur.identifiant,
            "genere_par_nom": utilisateur.nom_complet or utilisateur.identifiant,
        },
    )
    return rapport
