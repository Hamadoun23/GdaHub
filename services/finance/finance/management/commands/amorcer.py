"""Installe les referentiels du service financier.

    python manage.py amorcer

Rejouable. Les circuits de validation s'installent avec
`python manage.py amorcer_circuits`, commande fournie par le socle.
"""

from django.core.management.base import BaseCommand

from finance.referentiels import categorie_par_defaut


class Command(BaseCommand):
    help = "Cree la categorie de depense par defaut."

    def handle(self, *args, **options):
        categorie = categorie_par_defaut()
        self.stdout.write(
            self.style.SUCCESS(
                f"Categorie par defaut : {categorie.code} - {categorie.libelle}"
            )
        )
