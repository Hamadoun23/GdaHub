"""Les types d'absence dont l'application a besoin pour fonctionner.

Deux seulement, la ou l'application en comptait des dizaines : « Retard » et
« Permission », vises chacun par leur ecran. Le reste du referentiel se cree a
l'usage — un agent saisit son type de conge en clair, le type est materialise
a la volee.

Ces deux-la font exception parce que leur ecran ne demande pas de type : il
l'impose. Un libelle saisi en clair y produirait un type de categorie
« Conge », et le signalement se mettrait a decompter des jours.
"""

from django.db import transaction

from rh.models import CategorieAbsence, TypeAbsence

#: Type vise par l'ecran « Signaler un retard ».
CODE_RETARD = "RETARD"

#: Type vise par l'ecran « Mes permissions ».
CODE_PERMISSION = "PERMISSION"


@transaction.atomic
def charger_referentiels() -> tuple[TypeAbsence, TypeAbsence]:
    """Cree les deux types indispensables, sans ecraser un reglage existant."""
    retard, _ = TypeAbsence.objects.update_or_create(
        code=CODE_RETARD,
        defaults={
            "libelle": "Retard",
            "categorie": CategorieAbsence.RETARD,
            # Un retard ne se decompte d'aucun solde et ne marque pas la
            # journee comme absente : c'est un signalement.
            "decompte_solde": False,
            "duree_max_jours": 1,
            "justificatif_requis": False,
            "actif": True,
        },
    )
    permission, _ = TypeAbsence.objects.update_or_create(
        code=CODE_PERMISSION,
        defaults={
            "libelle": "Permission",
            "categorie": CategorieAbsence.PERMISSION,
            # Une permission est une absence autorisee de courte duree : elle
            # se demande, elle se valide, mais elle ne se prend pas sur les
            # conges annuels. C'est ce qui la distingue d'un conge.
            "decompte_solde": False,
            "duree_max_jours": 3,
            "justificatif_requis": False,
            "actif": True,
        },
    )
    return retard, permission


def type_retard() -> TypeAbsence:
    return charger_referentiels()[0]


def type_permission() -> TypeAbsence:
    return charger_referentiels()[1]
