"""La categorie de depense appliquee quand le demandeur n'en choisit aucune.

Une seule entree, la ou l'application en comptait des dizaines : le formulaire
de demande d'engagement tient en quatre champs, et le reste du referentiel se
cree a l'usage depuis l'ecran Finance.
"""

from finance.models import CategorieDepense

#: Categorie appliquee d'office aux demandes sans imputation choisie.
CODE_DEFAUT = "GEN"


def categorie_par_defaut() -> CategorieDepense:
    categorie, _ = CategorieDepense.objects.get_or_create(
        code=CODE_DEFAUT, defaults={"libelle": "Demande generale", "imputation": ""}
    )
    return categorie
