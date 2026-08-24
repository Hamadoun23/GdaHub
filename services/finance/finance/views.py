"""Vues du domaine Finance.

Meme grammaire que les ressources humaines : un agent voit ses dossiers, un
encadrant ceux de son equipe, le service financier et la direction voient
tout. Les documents validables heritent des actions de circulation du socle.
"""

from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone
from gdahub_common.constantes import StatutDocument
from gdahub_common.permissions import EstHabilite
from gdahub_common.validation import annuaire
from gdahub_common.validation.mixins import CirculationMixin, PerimetreMixin
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from finance.models import (
    ApprovisionnementCaisse,
    BaremePerdiem,
    BonCommande,
    Caisse,
    CategorieDepense,
    ConsommationCommunication,
    DemandePrix,
    Depense,
    ForfaitCommunication,
    Fournisseur,
    LigneFraisMission,
    LigneRequisition,
    Mission,
    OffreFournisseur,
    Prestation,
    Requisition,
    SortieCaisse,
    StatutDemandePrix,
)
from finance.permissions import EcritureReserveeAuFinancier, EstFinancier
from finance.serializers import (
    ApprovisionnementCaisseSerializer,
    BaremePerdiemSerializer,
    BonCommandeSerializer,
    CaisseSerializer,
    CategorieDepenseSerializer,
    ConsommationCommunicationSerializer,
    DemandePrixSerializer,
    DepenseSerializer,
    ForfaitCommunicationSerializer,
    FournisseurSerializer,
    LigneFraisMissionSerializer,
    LigneRequisitionSerializer,
    MissionSerializer,
    OffreFournisseurSerializer,
    PrestationSerializer,
    RequisitionSerializer,
    SortieCaisseSerializer,
)

#: Qui voit tout le perimetre financier.
ROLES_GLOBAUX = frozenset({"gestionnaire", "direction"})


# --- Referentiels ----------------------------------------------------------


class FournisseurViewSet(viewsets.ModelViewSet):
    permission_classes = [EstHabilite, EcritureReserveeAuFinancier]
    queryset = Fournisseur.objects.all()
    serializer_class = FournisseurSerializer
    filterset_fields = ["actif", "categorie"]
    search_fields = ["code", "raison_sociale", "contact", "numero_fiscal"]


class CategorieDepenseViewSet(viewsets.ModelViewSet):
    permission_classes = [EstHabilite, EcritureReserveeAuFinancier]
    queryset = CategorieDepense.objects.all()
    serializer_class = CategorieDepenseSerializer
    filterset_fields = ["actif"]
    search_fields = ["code", "libelle", "imputation"]


class BaremePerdiemViewSet(viewsets.ModelViewSet):
    permission_classes = [EstHabilite, EcritureReserveeAuFinancier]
    queryset = BaremePerdiem.objects.all()
    serializer_class = BaremePerdiemSerializer
    filterset_fields = ["zone", "actif"]


# --- Requisitions ----------------------------------------------------------


class RequisitionViewSet(PerimetreMixin, CirculationMixin, viewsets.ModelViewSet):
    permission_classes = [EstHabilite]
    roles_globaux = ROLES_GLOBAUX
    queryset = Requisition.objects.prefetch_related("lignes", "etapes")
    serializer_class = RequisitionSerializer
    filterset_fields = ["statut", "priorite", "departement_id"]
    search_fields = ["numero", "objet", "demandeur_nom"]
    ordering_fields = ["cree_le", "montant", "date_besoin"]

    def perform_create(self, serializer):
        """Le departement du demandeur impute la requisition par defaut.

        Personne ne saisit son propre departement a chaque demande : il est
        connu, et le laisser vide priverait le suivi budgetaire de sa seule
        cle de regroupement.
        """
        contexte = annuaire.contexte_du_demandeur(self.request.user)
        document = serializer.save(
            departement_id=contexte.get("departement_id"),
            departement_nom=contexte.get("departement_nom", ""),
        )
        document.appliquer_contexte(contexte)
        document.save()


class LigneRequisitionViewSet(viewsets.ModelViewSet):
    """Les lignes d'une requisition.

    Elles se modifient tant que la requisition appartient encore a son auteur.
    Le montant total suit automatiquement.
    """

    permission_classes = [EstHabilite]
    queryset = LigneRequisition.objects.select_related("requisition")
    serializer_class = LigneRequisitionSerializer
    filterset_fields = ["requisition"]

    def _verifier_ouverte(self, requisition):
        from gdahub_common.validation.moteur import raison_verrou

        raison = raison_verrou(requisition)
        if raison:
            raise ValidationError({"requisition": raison})

    def perform_create(self, serializer):
        self._verifier_ouverte(serializer.validated_data["requisition"])
        serializer.save()

    def perform_update(self, serializer):
        self._verifier_ouverte(serializer.instance.requisition)
        serializer.save()

    def perform_destroy(self, instance):
        self._verifier_ouverte(instance.requisition)
        instance.delete()


# --- Consultations et achats -----------------------------------------------


class DemandePrixViewSet(viewsets.ModelViewSet):
    """La mise en concurrence, reservee au service financier."""

    permission_classes = [EstHabilite, EstFinancier]
    queryset = DemandePrix.objects.prefetch_related("offres__fournisseur")
    serializer_class = DemandePrixSerializer
    filterset_fields = ["statut", "requisition"]
    search_fields = ["numero", "objet"]

    def perform_create(self, serializer):
        serializer.save(
            acheteur_identifiant=self.request.user.identifiant,
            acheteur_nom=self.request.user.nom_complet,
        )

    @action(detail=True, methods=["post"])
    def attribuer(self, requete, pk=None):
        """Retient une offre et clot la consultation.

        Une seule offre peut etre retenue : attribuer deux fois la meme
        consultation laisserait deux bons de commande legitimes pour un seul
        besoin.
        """
        demande = self.get_object()
        offre_id = requete.data.get("offre")
        offre = demande.offres.filter(pk=offre_id).first()
        if offre is None:
            raise ValidationError(
                {"offre": "Cette offre n'appartient pas a la consultation."}
            )
        demande.offres.update(retenue=False)
        offre.retenue = True
        offre.save(update_fields=["retenue", "modifie_le"])
        demande.statut = StatutDemandePrix.ATTRIBUEE
        demande.save(update_fields=["statut", "modifie_le"])
        return Response(self.get_serializer(demande).data)


class OffreFournisseurViewSet(viewsets.ModelViewSet):
    permission_classes = [EstHabilite, EstFinancier]
    queryset = OffreFournisseur.objects.select_related("fournisseur", "demande_prix")
    serializer_class = OffreFournisseurSerializer
    filterset_fields = ["demande_prix", "fournisseur", "retenue"]


class BonCommandeViewSet(PerimetreMixin, CirculationMixin, viewsets.ModelViewSet):
    permission_classes = [EstHabilite]
    roles_globaux = ROLES_GLOBAUX
    queryset = BonCommande.objects.select_related("fournisseur").prefetch_related(
        "etapes"
    )
    serializer_class = BonCommandeSerializer
    filterset_fields = ["statut", "fournisseur", "requisition"]
    search_fields = ["numero", "objet"]
    ordering_fields = ["cree_le", "montant"]

    @action(detail=True, methods=["post"])
    def receptionner(self, requete, pk=None):
        """Enregistre la livraison et clot le bon de commande."""
        bon = self.get_object()
        if bon.statut != StatutDocument.APPROUVE:
            raise ValidationError(
                {"statut": "Seul un bon approuve peut etre receptionne."}
            )
        bon.date_livraison_reelle = requete.data.get(
            "date_livraison_reelle"
        ) or timezone.localdate()
        bon.statut = StatutDocument.CLOTURE
        bon.save(
            update_fields=["date_livraison_reelle", "statut", "modifie_le"]
        )
        return Response(self.get_serializer(bon).data)


# --- Caisse ----------------------------------------------------------------


class CaisseViewSet(viewsets.ModelViewSet):
    permission_classes = [EstHabilite, EcritureReserveeAuFinancier]
    queryset = Caisse.objects.all()
    serializer_class = CaisseSerializer
    filterset_fields = ["actif", "devise"]
    search_fields = ["code", "libelle"]

    @action(detail=False, methods=["get"], url_path="sous-alerte")
    def sous_alerte(self, requete):
        """Les caisses a reapprovisionner.

        Le seuil se calcule, il ne se stocke pas : une caisse sous alerte le
        devient au fil des sorties, sans que personne ait a le declarer.
        """
        caisses = [
            caisse for caisse in self.get_queryset().filter(actif=True) if caisse.sous_alerte
        ]
        return Response(CaisseSerializer(caisses, many=True).data)


class ApprovisionnementCaisseViewSet(viewsets.ModelViewSet):
    permission_classes = [EstHabilite, EstFinancier]
    queryset = ApprovisionnementCaisse.objects.select_related("caisse")
    serializer_class = ApprovisionnementCaisseSerializer
    filterset_fields = ["caisse"]

    def perform_create(self, serializer):
        serializer.save(
            enregistre_par_identifiant=self.request.user.identifiant,
            enregistre_par_nom=self.request.user.nom_complet,
        )


class SortieCaisseViewSet(PerimetreMixin, CirculationMixin, viewsets.ModelViewSet):
    permission_classes = [EstHabilite]
    roles_globaux = ROLES_GLOBAUX
    queryset = SortieCaisse.objects.select_related("caisse", "categorie").prefetch_related(
        "etapes"
    )
    serializer_class = SortieCaisseSerializer
    filterset_fields = ["statut", "caisse", "categorie"]
    search_fields = ["numero", "beneficiaire", "motif"]
    ordering_fields = ["date_sortie", "montant"]

    @action(detail=True, methods=["post"])
    def decaisser(self, requete, pk=None):
        """Constate la sortie effective des especes.

        C'est ce geste, et non l'approbation, qui fait bouger le solde de la
        caisse : entre les deux, l'argent est engage mais toujours la.
        """
        sortie = self.get_object()
        if sortie.statut != StatutDocument.APPROUVE:
            raise ValidationError(
                {"statut": "Seule une sortie approuvee peut etre decaissee."}
            )
        if sortie.montant > sortie.caisse.solde_actuel:
            raise ValidationError(
                {
                    "montant": f"Solde insuffisant : la caisse contient "
                    f"{sortie.caisse.solde_actuel}."
                }
            )
        sortie.date_decaissement = timezone.now()
        sortie.decaisse_par_identifiant = requete.user.identifiant
        sortie.statut = StatutDocument.CLOTURE
        sortie.save(
            update_fields=[
                "date_decaissement",
                "decaisse_par_identifiant",
                "statut",
                "modifie_le",
            ]
        )
        return Response(self.get_serializer(sortie).data)


class DepenseViewSet(PerimetreMixin, CirculationMixin, viewsets.ModelViewSet):
    permission_classes = [EstHabilite]
    roles_globaux = ROLES_GLOBAUX
    queryset = Depense.objects.select_related("categorie", "fournisseur").prefetch_related(
        "etapes"
    )
    serializer_class = DepenseSerializer
    filterset_fields = ["statut", "categorie", "fournisseur", "departement_id", "mode_paiement"]
    search_fields = ["numero", "libelle", "reference_paiement"]
    ordering_fields = ["date_depense", "montant"]

    def perform_create(self, serializer):
        contexte = annuaire.contexte_du_demandeur(self.request.user)
        document = serializer.save(
            departement_id=contexte.get("departement_id"),
            departement_nom=contexte.get("departement_nom", ""),
        )
        document.appliquer_contexte(contexte)
        document.save()


# --- Missions --------------------------------------------------------------


class MissionViewSet(PerimetreMixin, CirculationMixin, viewsets.ModelViewSet):
    permission_classes = [EstHabilite]
    roles_globaux = ROLES_GLOBAUX
    queryset = Mission.objects.select_related("bareme").prefetch_related("frais", "etapes")
    serializer_class = MissionSerializer
    filterset_fields = ["statut", "zone"]
    search_fields = ["numero", "objet", "destination"]
    ordering_fields = ["date_depart", "montant"]

    @action(detail=True, methods=["post"], url_path="deposer-rapport")
    def deposer_rapport(self, requete, pk=None):
        """Le rapport de mission, attendu au retour."""
        mission = self.get_object()
        rapport = (requete.data.get("rapport") or "").strip()
        if not rapport:
            raise ValidationError({"rapport": "Le rapport ne peut pas etre vide."})
        mission.rapport = rapport
        mission.date_rapport = timezone.localdate()
        mission.save(update_fields=["rapport", "date_rapport", "modifie_le"])
        return Response(self.get_serializer(mission).data)


class LigneFraisMissionViewSet(viewsets.ModelViewSet):
    permission_classes = [EstHabilite]
    queryset = LigneFraisMission.objects.select_related("mission", "categorie")
    serializer_class = LigneFraisMissionSerializer
    filterset_fields = ["mission", "valide"]

    @action(detail=True, methods=["post"])
    def valider(self, requete, pk=None):
        """Le service financier atteste qu'un frais est justifie."""
        if not requete.user.a_role("gestionnaire", "direction"):
            raise ValidationError(
                {"detail": "Seul le service financier valide un frais de mission."}
            )
        frais = self.get_object()
        frais.valide = True
        frais.save(update_fields=["valide", "modifie_le"])
        return Response(self.get_serializer(frais).data)


class PrestationViewSet(PerimetreMixin, CirculationMixin, viewsets.ModelViewSet):
    permission_classes = [EstHabilite]
    roles_globaux = ROLES_GLOBAUX
    queryset = Prestation.objects.select_related("prestataire").prefetch_related("etapes")
    serializer_class = PrestationSerializer
    filterset_fields = ["statut", "prestataire"]
    search_fields = ["numero", "objet"]
    ordering_fields = ["date_debut", "montant"]


# --- Communication ---------------------------------------------------------


class ForfaitCommunicationViewSet(viewsets.ModelViewSet):
    permission_classes = [EstHabilite, EcritureReserveeAuFinancier]
    queryset = ForfaitCommunication.objects.prefetch_related("consommations")
    serializer_class = ForfaitCommunicationSerializer
    filterset_fields = ["actif", "type_forfait", "operateur"]
    search_fields = ["agent_nom", "numero_ligne", "operateur"]

    def get_queryset(self):
        queryset = super().get_queryset()
        utilisateur = self.request.user
        if utilisateur.est_superadmin or utilisateur.a_role(*ROLES_GLOBAUX):
            return queryset
        return queryset.filter(agent_identifiant=utilisateur.identifiant)


class ConsommationCommunicationViewSet(viewsets.ModelViewSet):
    permission_classes = [EstHabilite, EcritureReserveeAuFinancier]
    queryset = ConsommationCommunication.objects.select_related("forfait")
    serializer_class = ConsommationCommunicationSerializer
    filterset_fields = ["forfait", "mois"]


class TableauDeBord(APIView):
    """Les chiffres du mois, en un seul appel."""

    permission_classes = [EstHabilite]

    def get(self, requete):
        utilisateur = requete.user
        aujourdhui = timezone.localdate()
        debut_mois = aujourdhui.replace(day=1)

        mes_depenses = Depense.objects.filter(
            demandeur_identifiant=utilisateur.identifiant
        )
        donnees = {
            "mes_demandes_en_cours": sum(
                modele.objects.filter(
                    demandeur_identifiant=utilisateur.identifiant,
                    statut=StatutDocument.EN_VALIDATION,
                ).count()
                for modele in (Requisition, Depense, SortieCaisse, Mission, Prestation)
            ),
            "mes_depenses_du_mois": mes_depenses.filter(
                date_depense__gte=debut_mois, statut=StatutDocument.APPROUVE
            ).aggregate(total=Sum("montant"))["total"]
            or Decimal("0"),
        }

        if utilisateur.a_role(*ROLES_GLOBAUX) or utilisateur.est_superadmin:
            donnees["depenses_du_mois"] = Depense.objects.filter(
                date_depense__gte=debut_mois, statut=StatutDocument.APPROUVE
            ).aggregate(total=Sum("montant"))["total"] or Decimal("0")
            donnees["a_traiter"] = sum(
                modele.objects.filter(statut=StatutDocument.EN_VALIDATION).count()
                for modele in (Requisition, Depense, SortieCaisse, Mission, Prestation)
            )
            donnees["caisses_sous_alerte"] = sum(
                1 for caisse in Caisse.objects.filter(actif=True) if caisse.sous_alerte
            )
        return Response(donnees)
