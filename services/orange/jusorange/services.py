"""Regles metier du domaine Jus d'Orange."""

from __future__ import annotations

from datetime import timedelta

from django.db import transaction

from jusorange.models import (
    ArticleStock,
    Bouteille,
    Conditionnement,
    TypeArticle,
    recalculer_stock_oranges,
)

#: Duree de conservation d'une bouteille, faute de date saisie.
#: Reprise du parametrage d'origine : six mois apres le conditionnement.
CONSERVATION_JOURS = 180

__all__ = [
    "recalculer_stock_oranges",
    "produire_bouteilles",
    "stock_de",
]


def stock_de(type_article: str) -> float:
    article = ArticleStock.objects.filter(type_article=type_article).first()
    return article.quantite if article else 0.0


@transaction.atomic
def produire_bouteilles(conditionnement: Conditionnement) -> int:
    """Materialise les bouteilles d'un conditionnement.

    Une ligne par bouteille : c'est ce qui permet de rappeler un lot precis
    quand une DLC est depassee, au lieu de retirer toute la production du
    mois. Le cout en volume est reel — quelques milliers de lignes par
    conditionnement — mais c'est le prix de la tracabilite alimentaire.

    Les bouteilles deja creees ne sont pas dupliquees : la fonction se
    rejoue sans risque si un conditionnement est corrige.
    """
    existantes = conditionnement.bouteilles.count()
    if existantes:
        return 0

    limite = conditionnement.date_conditionnement + timedelta(days=CONSERVATION_JOURS)
    lot = [
        Bouteille(
            conditionnement=conditionnement,
            format_litre=format_litre,
            date_limite=limite,
        )
        for format_litre, quantite in (
            (False, conditionnement.quantite_33cl),
            (True, conditionnement.quantite_1l),
        )
        for _ in range(max(quantite, 0))
    ]
    Bouteille.objects.bulk_create(lot, batch_size=1000)

    _mettre_a_jour_stock_jus()
    return len(lot)


def _mettre_a_jour_stock_jus() -> None:
    """Le stock de jus suit les bouteilles disponibles.

    Comme pour les oranges, on recompte plutot que d'incrementer : un
    conditionnement corrige ou des bouteilles mises au rebut laisseraient
    sinon un compteur faux.
    """
    from jusorange.models import StatutBouteille

    disponibles = Bouteille.objects.filter(statut=StatutBouteille.DISPONIBLE)
    for type_article, format_litre in (
        (TypeArticle.JUS_33, False),
        (TypeArticle.JUS_1L, True),
    ):
        article, _ = ArticleStock.objects.get_or_create(
            type_article=type_article, defaults={"seuil_alerte": 100}
        )
        article.quantite = disponibles.filter(format_litre=format_litre).count()
        article.save(update_fields=["quantite", "modifie_le"])
