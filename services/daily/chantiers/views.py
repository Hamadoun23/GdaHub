"""Vues du domaine Chantiers."""

from django.utils import timezone
from gdahub_common.permissions import EstHabilite
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from chantiers import services
from chantiers.models import (
    AffectationProjet,
    JournalActivite,
    MiseAJourJournaliere,
    Phase,
    Photo,
    Projet,
    RapportJournalier,
    SousPhase,
    Tache,
)
from chantiers.permissions import EcritureReserveeALEquipe, est_partenaire
from chantiers.serializers import (
    AffectationProjetSerializer,
    JournalActiviteSerializer,
    MiseAJourJournaliereSerializer,
    PhaseSerializer,
    PhotoSerializer,
    ProjetDetailSerializer,
    ProjetSerializer,
    RapportJournalierSerializer,
    SousPhaseSerializer,
    TacheSerializer,
)


class ProjetViewSet(viewsets.ModelViewSet):
    """Les chantiers."""

    permission_classes = [EstHabilite, EcritureReserveeALEquipe]
    queryset = Projet.objects.prefetch_related("affectations")
    serializer_class = ProjetSerializer
    filterset_fields = ["statut"]
    search_fields = ["nom", "client", "description"]
    ordering_fields = ["ordre", "date_debut", "nom"]

    def get_queryset(self):
        return services.projets_visibles(super().get_queryset(), self.request.user)

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ProjetDetailSerializer
        return ProjetSerializer

    def get_serializer_context(self):
        return {
            **super().get_serializer_context(),
            "masquer_partenaire": est_partenaire(self.request.user),
        }

    def perform_create(self, serializer):
        projet = serializer.save()
        services.journaliser(
            self.request.user,
            "creation_projet",
            objet_type="Projet",
            objet_id=projet.pk,
            projet_id=projet.pk,
            description=projet.nom,
        )

    @action(detail=True, methods=["post"], url_path="affecter")
    def affecter(self, requete, pk=None):
        """Ajoute un agent a l'equipe du chantier.

        L'identifiant vient de l'annuaire, cote front : ce service ne tient
        pas la liste des agents et n'a pas a la valider.
        """
        projet = self.get_object()
        identifiant = (requete.data.get("agent_identifiant") or "").strip().lower()
        if not identifiant:
            raise ValidationError({"agent_identifiant": "Identifiant obligatoire."})
        affectation, creee = AffectationProjet.objects.update_or_create(
            projet=projet,
            agent_identifiant=identifiant,
            defaults={
                "agent_nom": requete.data.get("agent_nom", ""),
                "affecte_par": requete.user.identifiant,
            },
        )
        if creee:
            services.journaliser(
                requete.user,
                "affectation",
                objet_type="Projet",
                objet_id=projet.pk,
                projet_id=projet.pk,
                description=f"{identifiant} affecte au chantier",
            )
        return Response(AffectationProjetSerializer(affectation).data)

    @action(detail=True, methods=["post"], url_path="retirer")
    def retirer(self, requete, pk=None):
        projet = self.get_object()
        identifiant = (requete.data.get("agent_identifiant") or "").strip().lower()
        AffectationProjet.objects.filter(
            projet=projet, agent_identifiant=identifiant
        ).delete()
        return Response({"agent_identifiant": identifiant, "retire": True})

    @action(detail=True, methods=["get"], url_path="tableau")
    def tableau(self, requete, pk=None):
        """L'avancement du chantier, phase par phase.

        Une seule route plutot qu'un appel par phase : un chantier en compte
        volontiers une dizaine, et l'ecran doit s'afficher d'un coup.
        """
        projet = self.get_object()
        return Response(
            {
                "projet": ProjetSerializer(projet).data,
                "avancement_par_phase": projet.avancement_par_phase(),
                "taches_totales": projet.nombre_de_taches(),
            }
        )


class PhaseViewSet(viewsets.ModelViewSet):
    permission_classes = [EstHabilite, EcritureReserveeALEquipe]
    queryset = Phase.objects.select_related("projet").prefetch_related(
        "sous_phases__taches"
    )
    serializer_class = PhaseSerializer
    filterset_fields = ["projet"]
    ordering_fields = ["ordre"]

    def get_queryset(self):
        queryset = super().get_queryset()
        if est_partenaire(self.request.user):
            queryset = queryset.filter(masquee_partenaire=False)
        return queryset


class SousPhaseViewSet(viewsets.ModelViewSet):
    permission_classes = [EstHabilite, EcritureReserveeALEquipe]
    queryset = SousPhase.objects.select_related("phase").prefetch_related("taches")
    serializer_class = SousPhaseSerializer
    filterset_fields = ["phase"]

    def get_queryset(self):
        queryset = super().get_queryset()
        if est_partenaire(self.request.user):
            queryset = queryset.filter(masquee_partenaire=False)
        return queryset


class TacheViewSet(viewsets.ModelViewSet):
    permission_classes = [EstHabilite, EcritureReserveeALEquipe]
    queryset = Tache.objects.select_related("sous_phase__phase__projet")
    serializer_class = TacheSerializer
    filterset_fields = ["sous_phase", "sous_phase__phase", "sous_phase__phase__projet"]
    search_fields = ["activite"]

    def get_queryset(self):
        queryset = super().get_queryset()
        if est_partenaire(self.request.user):
            queryset = queryset.filter(masquee_partenaire=False)
        return queryset

    @action(detail=True, methods=["post"], url_path="avancement")
    def avancement(self, requete, pk=None):
        """La saisie du jour sur une tache.

        C'est le geste central de l'application : un chef de chantier le
        repete quinze fois par jour, et tout le reste en decoule.
        """
        if not requete.user.a_role("admin", "chef_chantier", "ingenieur", "controle_qualite"):
            raise ValidationError(
                {"detail": "Seule l'equipe du chantier saisit l'avancement."}
            )
        tache = self.get_object()
        valeur = requete.data.get("avancement")
        if valeur is None:
            raise ValidationError({"avancement": "Valeur obligatoire."})
        try:
            valeur = int(valeur)
        except (TypeError, ValueError) as erreur:
            raise ValidationError({"avancement": "Nombre attendu."}) from erreur
        if not 0 <= valeur <= 100:
            raise ValidationError({"avancement": "Valeur attendue entre 0 et 100."})

        jour = requete.data.get("date_rapport") or timezone.localdate()
        mise_a_jour = services.enregistrer_avancement(
            tache,
            jour,
            valeur,
            (requete.data.get("commentaire") or "").strip(),
            requete.user,
        )
        return Response(MiseAJourJournaliereSerializer(mise_a_jour).data)

    @action(detail=True, methods=["get"])
    def historique(self, requete, pk=None):
        """Tout ce qui s'est dit sur cette tache."""
        tache = self.get_object()
        return Response(services.historique_de(tache))


class MiseAJourViewSet(viewsets.ReadOnlyModelViewSet):
    """Les saisies journalieres. Elles se lisent ; elles s'ecrivent par la tache."""

    permission_classes = [EstHabilite]
    queryset = MiseAJourJournaliere.objects.select_related("tache")
    serializer_class = MiseAJourJournaliereSerializer
    filterset_fields = ["tache", "date_rapport", "statut"]
    ordering_fields = ["date_rapport"]


class PhotoViewSet(viewsets.ModelViewSet):
    permission_classes = [EstHabilite, EcritureReserveeALEquipe]
    queryset = Photo.objects.select_related("projet")
    serializer_class = PhotoSerializer
    filterset_fields = ["projet", "categorie"]
    ordering_fields = ["cree_le", "prise_le"]

    def perform_create(self, serializer):
        fichier = serializer.validated_data.get("fichier")
        photo = serializer.save(
            agent_identifiant=self.request.user.identifiant,
            agent_nom=self.request.user.nom_complet,
            taille=getattr(fichier, "size", 0) or 0,
            nom_origine=getattr(fichier, "name", "") or "",
        )
        services.journaliser(
            self.request.user,
            "ajout_photo",
            objet_type="Photo",
            objet_id=photo.pk,
            projet_id=photo.projet_id,
            description=photo.legende or photo.get_categorie_display(),
        )


class RapportViewSet(viewsets.ModelViewSet):
    permission_classes = [EstHabilite, EcritureReserveeALEquipe]
    queryset = RapportJournalier.objects.select_related("projet")
    serializer_class = RapportJournalierSerializer
    filterset_fields = ["projet", "date_rapport"]
    ordering_fields = ["date_rapport"]

    def perform_create(self, serializer):
        rapport = serializer.save(
            agent_identifiant=self.request.user.identifiant,
            agent_nom=self.request.user.nom_complet,
        )
        # L'avancement global est fige au moment du rapport : c'est ce qui en
        # fait une piece datee plutot qu'un affichage qui change tout seul.
        services.cloturer_rapport(rapport.projet, rapport)
        services.journaliser(
            self.request.user,
            "rapport_journalier",
            objet_type="RapportJournalier",
            objet_id=rapport.pk,
            projet_id=rapport.projet_id,
            description=f"{rapport.projet.nom} - {rapport.date_rapport}",
        )


class JournalViewSet(viewsets.ReadOnlyModelViewSet):
    """Le journal d'activite, en lecture seule et pour l'equipe seulement."""

    permission_classes = [EstHabilite]
    queryset = JournalActivite.objects.all()
    serializer_class = JournalActiviteSerializer
    filterset_fields = ["projet_id", "action", "agent_identifiant"]
    ordering_fields = ["cree_le"]

    def get_queryset(self):
        if est_partenaire(self.request.user):
            return JournalActivite.objects.none()
        return super().get_queryset()


class TableauDeBord(APIView):
    """Les chiffres de l'ecran d'accueil des chantiers."""

    permission_classes = [EstHabilite]

    def get(self, requete):
        projets = services.projets_visibles(Projet.objects.all(), requete.user)
        aujourdhui = timezone.localdate()
        return Response(
            {
                "projets": projets.count(),
                "projets_en_cours": projets.filter(statut="EN_COURS").count(),
                "saisies_du_jour": MiseAJourJournaliere.objects.filter(
                    date_rapport=aujourdhui,
                    tache__sous_phase__phase__projet__in=projets,
                ).count(),
                "avancement_moyen": (
                    round(
                        sum(projet.avancement() for projet in projets)
                        / projets.count()
                    )
                    if projets.count()
                    else 0
                ),
            }
        )
