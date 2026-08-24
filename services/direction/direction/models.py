"""Modeles du domaine Direction.

Origine du code repris : FinanceRH/backend/core (circuits et seuils).

**Ce service possede peu de donnees, et c'est assume.** Les regles de circuit
vivent dans chaque service — ce sont des regles sur ses propres documents, et
les centraliser ferait dependre chaque soumission d'un appel reseau. Direction
les administre a travers l'API de chaque service, avec le jeton du directeur :
les droits voyagent avec la personne, pas avec une authentification de service
a inventer.

Ce qui lui appartient en propre, c'est la **memoire des indicateurs**. Un
tableau de bord consolide se reconstruit a la demande, mais comparer septembre
a aout suppose d'avoir garde septembre. C'est le role de `SyntheseMensuelle` :
une photographie datee, prise une fois, relue autant qu'on veut.

Reserve a garder en tete : un service qui ne possede presque rien est un
candidat naturel a la fusion. Si ces syntheses ne servent pas, Direction n'a
pas besoin d'exister separement — son tableau de bord serait un ecran du shell.
On tranchera sur des donnees reelles, pas maintenant.
"""

from django.db import models
from gdahub_common.validation.models import Horodate


class SyntheseMensuelle(Horodate):
    """Une photographie datee des indicateurs d'une application.

    Les indicateurs eux-memes sont libres : chaque service decide de ce qu'il
    publie, et la direction en fait ce qu'elle veut. Figer un schema ici
    obligerait a modifier ce service chaque fois qu'un domaine ajoute un
    chiffre.
    """

    mois = models.DateField("Mois", help_text="Premier jour du mois concerne.")
    application = models.CharField(
        "Application", max_length=32, help_text="rh, finance, bdm..."
    )
    indicateurs = models.JSONField("Indicateurs", default=dict)
    construite_par = models.CharField(
        "Construite par", max_length=150, blank=True
    )

    class Meta:
        db_table = "synthese_mensuelle"
        constraints = [
            models.UniqueConstraint(
                fields=["mois", "application"], name="une_synthese_par_mois_et_application"
            )
        ]
        ordering = ["-mois", "application"]
        verbose_name = "Synthese mensuelle"
        verbose_name_plural = "Syntheses mensuelles"

    def __str__(self):
        return f"{self.application} - {self.mois:%m/%Y}"
