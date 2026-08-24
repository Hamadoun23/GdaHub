"""Importe l'organigramme depuis le fichier d'effectif.

Rejouable : relancer la commande sur le meme fichier remet les fiches en
conformite sans rien effacer. Rien n'est supprime — l'organigramme se modifie
aussi depuis l'ecran Organisation, et un rechargement du fichier ne doit pas
faire disparaitre un departement cree entre-temps.

Le compte de connexion, lui, est cree par identity depuis le meme fichier
(`manage.py importer_comptes`). Les deux services ne se parlent pas : ils
derivent le meme identifiant grace a `gdahub_common.effectif`, et la fiche se
rattache a son compte a la premiere connexion de l'interesse.
"""

from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from gdahub_common import effectif

from organisation.models import Agent, Departement


class Command(BaseCommand):
    help = "Cree ou met a jour les departements et les fiches d'agent."

    def add_arguments(self, parseur):
        parseur.add_argument(
            "--dossier",
            help="Dossier contenant personnel.json (defaut : /effectif).",
        )
        parseur.add_argument(
            "--simuler",
            action="store_true",
            help="Affiche ce qui serait fait, sans rien ecrire.",
        )

    def handle(self, *args, **options):
        # Le detail ligne a ligne n'a d'interet qu'a l'ecran ; appelee
        # depuis un test ou un demarrage, la commande se tait.
        self.detaille = options["verbosity"] >= 1
        try:
            donnees = effectif.charger(
                Path(options["dossier"]) if options["dossier"] else None
            )
        except (effectif.EffectifIntrouvable, ValueError) as erreur:
            raise CommandError(str(erreur)) from erreur

        origine = donnees["_fichier"]
        if self.detaille:
            if not donnees["_reel"]:
                self.stdout.write(
                    self.style.WARNING(
                        f"Effectif anonyme ({origine}) : aucune donnee reelle importee."
                    )
                )
            else:
                self.stdout.write(f"Effectif reel : {origine}")

        with transaction.atomic():
            departements = self._departements(donnees)
            agents = self._agents(donnees, departements)
            self._responsables_de_departement(donnees, agents)

            if options["simuler"]:
                transaction.set_rollback(True)
                self.stdout.write(self.style.WARNING("Simulation : rien n'a ete ecrit."))

        if self.detaille:
            self.stdout.write(
                self.style.SUCCESS(
                    f"{len(departements)} departements, {len(agents)} agents."
                )
            )

    def _departements(self, donnees) -> dict:
        departements = {}
        for fiche in donnees.get("departements", []):
            departement, cree = Departement.objects.update_or_create(
                code=fiche["code"], defaults={"nom": fiche["nom"], "actif": True}
            )
            departements[fiche["code"]] = departement
            if self.detaille:
                self.stdout.write(
                    f"  departement {departement.code:8} {'cree' if cree else 'a jour'}"
                )

        # Les departements absents du fichier restent joignables : ils ont pu
        # etre crees depuis l'interface, et des agents y sont peut-etre deja.
        for departement in Departement.objects.exclude(code__in=departements):
            departements[departement.code] = departement
        return departements

    def _agents(self, donnees, departements) -> dict:
        """Cree les fiches dans l'ordre du fichier.

        L'ordre compte : un responsable doit preceder ceux qui lui sont
        rattaches, sinon son rattachement reste vide. C'est une contrainte du
        format d'origine, conservee telle quelle.
        """
        agents: dict[str, Agent] = {}

        for rang, fiche in enumerate(donnees.get("agents", []), start=1):
            identifiant = effectif.identifiant_de(fiche)
            responsable = agents.get(fiche.get("manager")) if fiche.get("manager") else None
            departement = departements.get(fiche.get("departement"))

            if fiche.get("manager") and responsable is None:
                self.stdout.write(
                    self.style.WARNING(
                        f"  {identifiant} : responsable « {fiche['manager']} » "
                        "inconnu a ce stade, rattachement laisse vide."
                    )
                )

            agent, cree = Agent.objects.update_or_create(
                identifiant=identifiant,
                defaults={
                    "prenom": fiche.get("prenom", ""),
                    "nom": fiche.get("nom", ""),
                    "email": fiche.get("email", ""),
                    "telephone": fiche.get("telephone", ""),
                    "poste": fiche.get("poste", ""),
                    "departement": departement,
                    "responsable": responsable,
                    "matricule": effectif.matricule_de(donnees, rang),
                    "actif": True,
                },
            )
            agents[fiche["username"]] = agent
            if self.detaille:
                self.stdout.write(
                    f"  agent {agent.matricule:9} {identifiant:32} "
                    f"{'cree' if cree else 'a jour'}"
                )

        return agents

    def _responsables_de_departement(self, donnees, agents):
        for code, username in donnees.get("responsables", {}).items():
            agent = agents.get(username)
            if agent is None:
                self.stdout.write(
                    self.style.WARNING(
                        f"  departement {code} : responsable « {username} » absent "
                        "de l'effectif."
                    )
                )
                continue
            Departement.objects.filter(code=code).update(responsable=agent)
