"""Jeu de donnees minimal : le catalogue des applications et un administrateur.

La commande est idempotente : elle se relance a chaque demarrage sans ecraser
ce qui a ete modifie depuis. Les roles disponibles, eux, sont realignes sur ce
fichier — c'est ici que le catalogue fait autorite.

Les listes de roles reprennent celles des applications d'origine, pour que la
reprise des comptes existants soit une correspondance ligne a ligne et non une
reinterpretation.
"""

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from comptes.models import Application, Habilitation, Utilisateur

APPLICATIONS = [
    {
        "code": "hub",
        "nom": "GDA Hub",
        "description": "Comptes, habilitations et journal des connexions.",
        "chemin": "/administration",
        "prefixe_api": "/api/identity",
        "couleur": "#0f766e",
        "ordre": 0,
        "roles_disponibles": [
            {"code": "admin", "libelle": "Administrateur du hub"},
            {"code": "lecture", "libelle": "Consultation de l'annuaire"},
        ],
    },
    {
        "code": "bdm",
        "nom": "Campagnes",
        "description": "Campagnes de cartes bancaires : ventes, enrolements, primes.",
        "chemin": "/campagnes",
        "prefixe_api": "/api/bdm",
        "couleur": "#1d4ed8",
        "ordre": 10,
        "roles_disponibles": [
            {"code": "admin", "libelle": "Administrateur"},
            {"code": "direction", "libelle": "Direction"},
            {"code": "commercial", "libelle": "Commercial terrain"},
            {"code": "commercial_telephonique", "libelle": "Commercial telephonique"},
        ],
    },
    {
        "code": "orange",
        "nom": "Jus d'Orange",
        "description": "Recolte, fabrication, entrepot et distribution.",
        "chemin": "/jus-orange",
        "prefixe_api": "/api/orange",
        "couleur": "#ea580c",
        "ordre": 20,
        "roles_disponibles": [
            {"code": "admin", "libelle": "Administrateur"},
            {"code": "direction", "libelle": "Direction"},
            {"code": "responsable_production", "libelle": "Responsable production"},
            {"code": "commercial", "libelle": "Commercial"},
            {"code": "finance", "libelle": "Finance"},
        ],
    },
    {
        "code": "daily",
        "nom": "Chantiers",
        "description": "Suivi de chantier : avancement, photos, rapport journalier.",
        "chemin": "/chantiers",
        "prefixe_api": "/api/daily",
        "couleur": "#b45309",
        "ordre": 30,
        "roles_disponibles": [
            {"code": "admin", "libelle": "Administrateur"},
            {"code": "chef_chantier", "libelle": "Chef de chantier"},
            {"code": "ingenieur", "libelle": "Ingenieur"},
            {"code": "controle_qualite", "libelle": "Controle qualite"},
            {"code": "partenaire", "libelle": "Partenaire (lecture seule)"},
        ],
    },
    {
        "code": "planning",
        "nom": "Planning",
        "description": "Publications, tournages et rapports clients.",
        "chemin": "/planning",
        "prefixe_api": "/api/planning",
        "couleur": "#7c3aed",
        "ordre": 40,
        "roles_disponibles": [
            {"code": "admin", "libelle": "Administrateur"},
            {"code": "team", "libelle": "Equipe"},
            {"code": "client", "libelle": "Client (ses donnees seulement)"},
        ],
    },
]


class Command(BaseCommand):
    help = "Cree le catalogue des applications et le compte administrateur."

    @transaction.atomic
    def handle(self, *args, **options):
        for donnees in APPLICATIONS:
            application, cree = Application.objects.update_or_create(
                code=donnees["code"],
                defaults={
                    champ: valeur
                    for champ, valeur in donnees.items()
                    if champ != "code"
                },
            )
            etat = "creee" if cree else "mise a jour"
            self.stdout.write(f"Application {application.code} {etat}.")

        identifiant = settings.GDAHUB_ADMIN_IDENTIFIANT.strip().lower()
        administrateur = Utilisateur.objects.filter(identifiant=identifiant).first()
        if administrateur is None:
            administrateur = Utilisateur.objects.create_superuser(
                identifiant=identifiant,
                mot_de_passe=settings.GDAHUB_ADMIN_MOT_DE_PASSE,
                nom="Administrateur",
                fonction="Administration GDA Hub",
            )
            self.stdout.write(
                self.style.SUCCESS(f"Compte administrateur cree : {identifiant}")
            )
            self.stdout.write(
                self.style.WARNING(
                    "Mot de passe issu de la configuration : changez-le a la "
                    "premiere connexion."
                )
            )
        else:
            self.stdout.write(f"Compte administrateur deja present : {identifiant}")

        # L'administrateur est habilite partout : c'est le compte de secours
        # tant que les habilitations reelles ne sont pas saisies.
        for application in Application.objects.all():
            Habilitation.objects.update_or_create(
                utilisateur=administrateur,
                application=application,
                defaults={"roles": ["admin"], "active": True},
            )
        self.stdout.write("Habilitations de l'administrateur alignees.")
