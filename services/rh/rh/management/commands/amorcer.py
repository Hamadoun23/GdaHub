"""Installe les referentiels du service des ressources humaines.

    python manage.py amorcer

Rejouable. Les circuits de validation, eux, s'installent avec
`python manage.py amorcer_circuits`, commande fournie par le socle.
"""

from django.core.management.base import BaseCommand

from rh.referentiels import charger_referentiels


class Command(BaseCommand):
    help = "Cree les types d'absence indispensables."

    def handle(self, *args, **options):
        retard, permission = charger_referentiels()
        self.stdout.write("Types d'absence")
        for type_absence in (retard, permission):
            self.stdout.write(
                f"  {type_absence.code:12} {type_absence.libelle:14} "
                f"categorie {type_absence.categorie}"
            )
        self.stdout.write(self.style.SUCCESS("Referentiels a jour."))
