"""Archive les indicateurs du mois, application par application.

    python manage.py construire_synthese --jeton <jeton>

Le jeton est celui d'un directeur : la consolidation passe par les API des
autres services, avec ses droits. C'est aussi ce qui rend cette commande
lancable depuis une tache planifiee sans lui confier de secret permanent.
"""

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from gdahub_common.identite import UtilisateurJeton

from direction import services
from direction.models import SyntheseMensuelle


class Command(BaseCommand):
    help = "Enregistre une photographie des indicateurs du mois."

    def add_arguments(self, parseur):
        parseur.add_argument(
            "--jeton", required=True, help="Jeton d'acces d'un directeur."
        )
        parseur.add_argument(
            "--identifiant",
            default="tache-planifiee",
            help="Qui declenche la synthese.",
        )

    def handle(self, *args, **options):
        porteur = UtilisateurJeton(
            id=0,
            identifiant=options["identifiant"],
            roles=["membre"],
            habilitations={"direction": ["membre"]},
            jeton=options["jeton"],
        )
        mois = timezone.localdate().replace(day=1)
        consolidation = services.consolider(porteur)

        enregistrees = 0
        for code, bloc in consolidation.items():
            if not bloc.get("disponible"):
                motif = bloc.get("motif")
                self.stdout.write(self.style.WARNING(f"  {code} ignore : {motif}"))
                continue
            SyntheseMensuelle.objects.update_or_create(
                mois=mois,
                application=code,
                defaults={
                    "indicateurs": bloc["indicateurs"],
                    "construite_par": options["identifiant"],
                },
            )
            enregistrees += 1
            self.stdout.write(f"  {code} archive")

        if not enregistrees:
            raise CommandError("Aucune application n'a repondu : rien n'a ete archive.")
        self.stdout.write(
            self.style.SUCCESS(f"{enregistrees} syntheses pour {mois:%m/%Y}.")
        )
