"""Regles metier du domaine Campagnes."""

from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.db.models import Count

from campagnes.models import (
    Campagne,
    Commercial,
    Prime,
    StatutCampagne,
    Vente,
)


def commercial_de(utilisateur) -> Commercial | None:
    """La fiche commerciale de la personne connectee, s'il y en a une.

    Un administrateur ou un membre de la direction n'en a pas : il pilote les
    campagnes sans y vendre.
    """
    return Commercial.objects.filter(
        identifiant=utilisateur.identifiant, actif=True
    ).first()


def perimetre_des_ventes(queryset, utilisateur):
    """Ce qu'une personne a le droit de voir.

    Un commercial ne voit que ses propres saisies. Un chef d'agence voit
    celles de son agence — c'est ce qui lui permet de repondre a sa direction
    sans passer par GDA. Administration et direction voient tout.
    """
    if utilisateur.est_superadmin or utilisateur.a_role("admin", "direction"):
        return queryset

    commercial = commercial_de(utilisateur)
    if commercial is None:
        return queryset.none()

    agences_dirigees = commercial.agence_id and _dirige_une_agence(commercial)
    if agences_dirigees:
        return queryset.filter(agence_id=commercial.agence_id)
    return queryset.filter(commercial=commercial)


def _dirige_une_agence(commercial: Commercial) -> bool:
    return commercial.agence is not None and (
        commercial.agence.chef_identifiant == commercial.identifiant
    )


def campagnes_ouvertes(utilisateur):
    """Les campagnes sur lesquelles cette personne peut saisir aujourd'hui.

    Trois conditions, et les trois comptent : la campagne tourne, elle
    concerne le partenaire de la personne, et celle-ci fait partie de son
    perimetre. En sauter une ouvre a un commercial BDM la saisie d'une
    campagne UBA.
    """
    commercial = commercial_de(utilisateur)
    ouvertes = [
        campagne
        for campagne in Campagne.objects.filter(actif=True).select_related("partenaire")
        if campagne.ouverte
    ]

    if utilisateur.est_superadmin or utilisateur.a_role("admin", "direction"):
        return ouvertes
    if commercial is None:
        return []
    return [
        campagne
        for campagne in ouvertes
        if campagne.partenaire_id == commercial.partenaire_id
        and campagne.engage(commercial)
    ]


def classement(campagne: Campagne, periode: str | None = None):
    """Le classement des commerciaux d'une campagne, par nombre de ventes.

    Les commerciaux du perimetre y figurent tous, y compris ceux qui n'ont
    rien vendu : un classement qui masque les absents ne dit pas grand-chose
    a un directeur commercial.
    """
    ventes = Vente.objects.filter(campagne=campagne)
    if periode:
        annee, mois = periode.split("-")
        ventes = ventes.filter(cree_le__year=int(annee), cree_le__month=int(mois))

    comptes = dict(
        ventes.values_list("commercial_id").annotate(total=Count("id")).values_list(
            "commercial_id", "total"
        )
    )
    lignes = [
        {
            "commercial_id": commercial.pk,
            "identifiant": commercial.identifiant,
            "nom_complet": commercial.nom_complet,
            "agence": commercial.agence.nom if commercial.agence else "",
            "ventes": comptes.get(commercial.pk, 0),
        }
        for commercial in campagne.commerciaux_du_perimetre().select_related("agence")
    ]
    lignes.sort(key=lambda ligne: (-ligne["ventes"], ligne["nom_complet"]))
    for rang, ligne in enumerate(lignes, start=1):
        ligne["rang"] = rang
    return lignes


@transaction.atomic
def calculer_primes(campagne: Campagne, periode: str) -> list[Prime]:
    """Attribue la prime du meilleur vendeur pour une periode.

    Une seule prime, au premier du classement, et seulement s'il a vendu. Une
    prime accordee a quelqu'un qui n'a rien vendu se remarquerait le jour du
    versement, et pas avant.

    Le calcul est rejouable : relancer sur la meme periode met a jour au lieu
    d'empiler. Les primes deja versees ne sont pas touchees — un versement
    constate ne se recalcule pas.
    """
    lignes = classement(campagne, periode)
    creees = []

    for ligne in lignes:
        deja = Prime.objects.filter(
            commercial_id=ligne["commercial_id"],
            periode=periode,
            campagne=campagne,
        ).first()
        if deja and deja.versee_le:
            continue

        montant = (
            Decimal(campagne.prime_meilleur_vendeur)
            if ligne["rang"] == 1 and ligne["ventes"] > 0
            else Decimal("0")
        )
        prime, _ = Prime.objects.update_or_create(
            commercial_id=ligne["commercial_id"],
            periode=periode,
            campagne=campagne,
            defaults={
                "montant": montant,
                "rang": ligne["rang"],
                "ventes_comptees": ligne["ventes"],
            },
        )
        creees.append(prime)
    return creees


def indicateurs(campagne: Campagne) -> dict:
    """Les chiffres d'une campagne, en quelques requetes."""
    return {
        "campagne": campagne.nom,
        "statut": campagne.statut_effectif,
        "ouverte": campagne.ouverte,
        "sans_agences": campagne.sans_agences,
        "agences": campagne.agences_du_perimetre().count(),
        "commerciaux": campagne.commerciaux_du_perimetre().count(),
        "ventes": campagne.ventes.count(),
        "enrolements": campagne.enrolements.count(),
        "contrats_acceptes": campagne.reponses_contrat.filter(
            statut="ACCEPTE"
        ).count(),
    }


def statuts_manuels_conserves(campagne: Campagne) -> bool:
    """Un statut pose a la main ne se recalcule jamais depuis les dates."""
    return campagne.statut in {StatutCampagne.ARRETEE, StatutCampagne.ANNULEE}
