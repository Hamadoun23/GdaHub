"""Vues du domaine Ressources humaines.

Trois niveaux de droit, hérités de l'application d'origine :

- **agent** — ses propres demandes, son solde, ses formations ;
- **encadrant** — en plus, les dossiers des agents qui lui sont rattaches.
  L'encadrement n'est pas un role : il se lit du rattachement recopie sur
  chaque dossier ;
- **gestionnaire** et **direction** — tout le perimetre.
"""

from django.utils import timezone
from gdahub_common.permissions import EstHabilite
from gdahub_common.validation import annuaire
from gdahub_common.validation.mixins import CirculationMixin, PerimetreMixin
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from rh import services
from rh.models import (
    CampagneEvaluation,
    CritereEvaluation,
    DemandeAbsence,
    Evaluation,
    Formation,
    InscriptionFormation,
    NoteCritere,
    Presence,
    SoldeConge,
    TypeAbsence,
)
from rh.permissions import EcritureReserveeAuxGestionnaires
from rh.serializers import (
    CampagneEvaluationSerializer,
    CritereEvaluationSerializer,
    DemandeAbsenceSerializer,
    EvaluationSerializer,
    FormationSerializer,
    InscriptionFormationSerializer,
    NoteCritereSerializer,
    PresenceSerializer,
    SoldeCongeSerializer,
    TypeAbsenceSerializer,
)

#: Qui voit tout le perimetre des ressources humaines.
ROLES_GLOBAUX = frozenset({"gestionnaire", "direction"})


class TypeAbsenceViewSet(viewsets.ModelViewSet):
    """Le referentiel des types de conge, d'absence et de permission."""

    permission_classes = [EstHabilite, EcritureReserveeAuxGestionnaires]
    queryset = TypeAbsence.objects.all()
    serializer_class = TypeAbsenceSerializer
    filterset_fields = ["categorie", "actif", "decompte_solde"]
    search_fields = ["code", "libelle"]


class DemandeAbsenceViewSet(PerimetreMixin, CirculationMixin, viewsets.ModelViewSet):
    """Conges, absences, permissions et retards.

    Le meme modele porte les quatre : ils suivent le meme circuit et ne se
    distinguent que par la categorie de leur type. Le front les separe en
    autant d'ecrans, parce qu'on ne demande pas une matinee d'absence comme on
    pose trois semaines de conge.
    """

    permission_classes = [EstHabilite]
    roles_globaux = ROLES_GLOBAUX
    queryset = DemandeAbsence.objects.select_related("type_absence").prefetch_related(
        "etapes"
    )
    serializer_class = DemandeAbsenceSerializer
    filterset_fields = ["statut", "type_absence", "demandeur_departement_id"]
    search_fields = ["numero", "motif", "demandeur_nom"]
    ordering_fields = ["date_debut", "cree_le", "nb_jours"]

    @action(detail=False, methods=["get"], url_path="par-categorie/(?P<categorie>[^/.]+)")
    def par_categorie(self, requete, categorie=None):
        """Les demandes d'une categorie : CONGE, PERMISSION, RETARD, ABSENCE."""
        queryset = self.filter_queryset(self.get_queryset()).filter(
            type_absence__categorie=categorie.upper()
        )
        return self._page(queryset)


class SoldeCongeViewSet(viewsets.ReadOnlyModelViewSet):
    """Les compteurs de jours. Ils se lisent, ils ne se saisissent pas.

    Un solde bouge au terme d'un circuit de validation, jamais a la main :
    c'est ce qui garantit qu'un jour retire correspond a un conge accorde.
    """

    permission_classes = [EstHabilite]
    queryset = SoldeConge.objects.all()
    serializer_class = SoldeCongeSerializer
    filterset_fields = ["annee", "agent_departement_id"]
    search_fields = ["agent_nom", "agent_identifiant"]

    def get_queryset(self):
        queryset = super().get_queryset()
        utilisateur = self.request.user
        if utilisateur.est_superadmin or utilisateur.a_role(*ROLES_GLOBAUX):
            return queryset
        return queryset.filter(agent_identifiant=utilisateur.identifiant)

    @action(detail=False, methods=["get"], url_path="mon-solde")
    def mon_solde(self, requete):
        """Le solde de l'annee en cours, cree au besoin.

        Sans fiche d'agent — un administrateur, un compte de service — on
        renvoie un solde vide plutot qu'une erreur : l'ecran doit s'afficher.
        """
        contexte = annuaire.contexte_facultatif(requete.user)
        if contexte is None:
            return Response(
                {
                    "agent_identifiant": requete.user.identifiant,
                    "agent_nom": requete.user.nom_complet,
                    "annee": timezone.localdate().year,
                    "jours_acquis": "0.0",
                    "jours_reportes": "0.0",
                    "jours_pris": "0.0",
                    "jours_restants": "0.0",
                    "sans_fiche": True,
                }
            )
        solde = services.solde_de(
            requete.user.identifiant, timezone.localdate().year, contexte
        )
        return Response(SoldeCongeSerializer(solde).data)


class PresenceViewSet(viewsets.ModelViewSet):
    """Le registre des presences."""

    permission_classes = [EstHabilite, EcritureReserveeAuxGestionnaires]
    queryset = Presence.objects.all()
    serializer_class = PresenceSerializer
    filterset_fields = ["date", "statut", "agent_departement_id"]
    search_fields = ["agent_nom", "agent_identifiant"]
    ordering_fields = ["date"]

    def get_queryset(self):
        queryset = super().get_queryset()
        utilisateur = self.request.user
        if utilisateur.est_superadmin or utilisateur.a_role(*ROLES_GLOBAUX):
            return queryset
        return queryset.filter(agent_identifiant=utilisateur.identifiant)

    def perform_create(self, serializer):
        serializer.save(saisi_par_identifiant=self.request.user.identifiant)


class CampagneEvaluationViewSet(viewsets.ModelViewSet):
    permission_classes = [EstHabilite, EcritureReserveeAuxGestionnaires]
    queryset = CampagneEvaluation.objects.prefetch_related("criteres")
    serializer_class = CampagneEvaluationSerializer
    filterset_fields = ["statut"]
    search_fields = ["libelle"]


class CritereEvaluationViewSet(viewsets.ModelViewSet):
    permission_classes = [EstHabilite, EcritureReserveeAuxGestionnaires]
    queryset = CritereEvaluation.objects.select_related("campagne")
    serializer_class = CritereEvaluationSerializer
    filterset_fields = ["campagne"]


class EvaluationViewSet(viewsets.ModelViewSet):
    """Les entretiens d'evaluation.

    Un agent voit la sienne et celles qu'il mene ; le back-office voit tout.
    """

    permission_classes = [EstHabilite]
    queryset = Evaluation.objects.select_related("campagne").prefetch_related(
        "notes__critere"
    )
    serializer_class = EvaluationSerializer
    filterset_fields = ["campagne", "statut", "agent_departement_id"]
    search_fields = ["agent_nom"]

    def get_queryset(self):
        queryset = super().get_queryset()
        utilisateur = self.request.user
        if utilisateur.est_superadmin or utilisateur.a_role(*ROLES_GLOBAUX):
            return queryset
        from django.db.models import Q

        return queryset.filter(
            Q(agent_identifiant=utilisateur.identifiant)
            | Q(evaluateur_identifiant=utilisateur.identifiant)
        )

    @action(detail=True, methods=["post"], url_path="noter")
    def noter(self, requete, pk=None):
        """Enregistre les notes par critere, puis recalcule la note globale.

        Les notes arrivent ensemble plutot qu'une par une : un entretien se
        conclut d'un bloc, et un enregistrement partiel laisserait une moyenne
        ponderee fausse a l'ecran.
        """
        evaluation = self.get_object()
        lignes = requete.data.get("notes") or []
        enregistrees = []
        for ligne in lignes:
            formulaire = NoteCritereSerializer(
                data={**ligne, "evaluation": evaluation.pk}
            )
            formulaire.is_valid(raise_exception=True)
            note, _ = NoteCritere.objects.update_or_create(
                evaluation=evaluation,
                critere=formulaire.validated_data["critere"],
                defaults={
                    "note": formulaire.validated_data["note"],
                    "commentaire": formulaire.validated_data.get("commentaire", ""),
                },
            )
            enregistrees.append(note)
        evaluation.recalculer_note()
        return Response(EvaluationSerializer(evaluation).data)


class FormationViewSet(viewsets.ModelViewSet):
    permission_classes = [EstHabilite, EcritureReserveeAuxGestionnaires]
    queryset = Formation.objects.prefetch_related("inscriptions")
    serializer_class = FormationSerializer
    filterset_fields = ["statut", "obligatoire", "categorie"]
    search_fields = ["titre", "organisme", "formateur"]
    ordering_fields = ["date_debut", "titre"]

    @action(detail=True, methods=["post"], url_path="m-inscrire")
    def m_inscrire(self, requete, pk=None):
        """Inscription de la personne connectee, si des places restent."""
        formation = self.get_object()
        if formation.places_restantes <= 0:
            return Response(
                {
                    "erreur": {
                        "code": "conflit",
                        "message": "Cette formation est complete.",
                        "details": {},
                    }
                },
                status=status.HTTP_409_CONFLICT,
            )
        contexte = annuaire.contexte_du_demandeur(requete.user)
        inscription, cree = InscriptionFormation.objects.get_or_create(
            formation=formation, agent_identifiant=requete.user.identifiant
        )
        if cree:
            inscription.appliquer_agent(contexte)
            inscription.save()
        return Response(
            InscriptionFormationSerializer(inscription).data,
            status=status.HTTP_201_CREATED if cree else status.HTTP_200_OK,
        )


class InscriptionFormationViewSet(viewsets.ModelViewSet):
    permission_classes = [EstHabilite]
    queryset = InscriptionFormation.objects.select_related("formation")
    serializer_class = InscriptionFormationSerializer
    filterset_fields = ["formation", "statut"]

    def get_queryset(self):
        queryset = super().get_queryset()
        utilisateur = self.request.user
        if utilisateur.est_superadmin or utilisateur.a_role(*ROLES_GLOBAUX):
            return queryset
        return queryset.filter(agent_identifiant=utilisateur.identifiant)


class TableauDeBord(APIView):
    """Les quelques chiffres qu'un ecran d'accueil affiche.

    Une seule route plutot que cinq appels depuis le navigateur : c'est ce qui
    fait la difference entre un tableau de bord qui s'affiche d'un coup et un
    qui se remplit par morceaux.
    """

    permission_classes = [EstHabilite]

    def get(self, requete):
        from gdahub_common.constantes import StatutDocument

        utilisateur = requete.user
        annee = timezone.localdate().year
        mes_demandes = DemandeAbsence.objects.filter(
            demandeur_identifiant=utilisateur.identifiant
        )

        contexte = annuaire.contexte_facultatif(utilisateur)
        solde = (
            services.solde_de(utilisateur.identifiant, annee, contexte)
            if contexte
            else None
        )

        donnees = {
            "solde": SoldeCongeSerializer(solde).data if solde else None,
            "sans_fiche": contexte is None,
            "mes_demandes_en_cours": mes_demandes.filter(
                statut=StatutDocument.EN_VALIDATION
            ).count(),
            "mes_demandes_annee": mes_demandes.filter(date_debut__year=annee).count(),
        }

        if utilisateur.a_role(*ROLES_GLOBAUX) or utilisateur.est_superadmin:
            donnees["a_traiter"] = DemandeAbsence.objects.filter(
                statut=StatutDocument.EN_VALIDATION
            ).count()
            donnees["effectif_en_conge"] = Presence.objects.filter(
                date=timezone.localdate(), statut="CONGE"
            ).count()
        return Response(donnees)
