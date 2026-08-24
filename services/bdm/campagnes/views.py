"""Vues du domaine Campagnes."""

from django.utils import timezone
from gdahub_common.permissions import EstHabilite
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from campagnes import services
from campagnes.models import (
    DELAI_CORRECTION_HEURES,
    AdhesionCarte,
    Agence,
    Campagne,
    Client,
    Commercial,
    Enrolement,
    Partenaire,
    Prime,
    RapportTelephonique,
    Reclamation,
    ReponseContrat,
    StatutReponseContrat,
    TypeCarte,
    Vente,
    VersementAide,
)
from campagnes.serializers import (
    AdhesionCarteSerializer,
    AgenceSerializer,
    CampagneSerializer,
    ClientSerializer,
    CommercialSerializer,
    EnrolementSerializer,
    PartenaireSerializer,
    PrimeSerializer,
    RapportTelephoniqueSerializer,
    ReclamationSerializer,
    ReponseContratSerializer,
    TypeCarteSerializer,
    VenteSerializer,
    VersementAideSerializer,
)

#: Qui parametre les campagnes, par opposition a qui vend sur le terrain.
ROLES_PILOTAGE = {"admin", "direction"}


class EcritureReserveeAuPilotage(permissions.BasePermission):
    """Un commercial saisit ses ventes ; il ne fixe pas les regles du jeu.

    Ouvrir le parametrage d'une campagne a ceux qui en tirent une prime n'est
    pas un debat de confiance : c'est une separation elementaire.
    """

    message = "Reserve a l'administration des campagnes."

    def has_permission(self, requete, vue):
        if requete.method in permissions.SAFE_METHODS:
            return True
        utilisateur = getattr(requete, "user", None)
        if utilisateur is None or not utilisateur.is_authenticated:
            return False
        return utilisateur.a_role(*ROLES_PILOTAGE)


class SaisieTerrainMixin:
    """Ce que partagent les ecrans de saisie du terrain.

    Le commercial et l'agence viennent de la fiche commerciale, jamais du
    corps de la requete : les laisser saisir permettrait d'attribuer une vente
    a quelqu'un d'autre, et donc de deplacer une prime.
    """

    def _commercial(self):
        commercial = services.commercial_de(self.request.user)
        if commercial is None:
            raise PermissionDenied(
                "Aucune fiche commerciale n'est rattachee a votre compte."
            )
        return commercial

    def perform_create(self, serializer):
        commercial = self._commercial()
        serializer.save(commercial=commercial, agence=commercial.agence)

    def _verifier_corrigible(self, instance):
        utilisateur = self.request.user
        if utilisateur.est_superadmin or utilisateur.a_role(*ROLES_PILOTAGE):
            return
        if instance.commercial.identifiant != utilisateur.identifiant:
            raise PermissionDenied("Cette saisie n'est pas la votre.")
        if not instance.corrigible:
            raise ValidationError(
                {
                    "detail": f"Passe {DELAI_CORRECTION_HEURES} heures, une "
                    "correction se demande a l'administration."
                }
            )

    def perform_update(self, serializer):
        self._verifier_corrigible(serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        self._verifier_corrigible(instance)
        instance.delete()


# --- Referentiels -----------------------------------------------------------


class PartenaireViewSet(viewsets.ModelViewSet):
    permission_classes = [EstHabilite, EcritureReserveeAuPilotage]
    queryset = Partenaire.objects.all()
    serializer_class = PartenaireSerializer
    filterset_fields = ["actif", "organisation"]
    search_fields = ["code", "nom"]


class AgenceViewSet(viewsets.ModelViewSet):
    permission_classes = [EstHabilite, EcritureReserveeAuPilotage]
    queryset = Agence.objects.select_related("partenaire")
    serializer_class = AgenceSerializer
    filterset_fields = ["partenaire", "actif"]
    search_fields = ["nom", "adresse"]


class TypeCarteViewSet(viewsets.ModelViewSet):
    permission_classes = [EstHabilite, EcritureReserveeAuPilotage]
    queryset = TypeCarte.objects.select_related("partenaire")
    serializer_class = TypeCarteSerializer
    filterset_fields = ["partenaire", "actif"]


class CommercialViewSet(viewsets.ModelViewSet):
    permission_classes = [EstHabilite, EcritureReserveeAuPilotage]
    queryset = Commercial.objects.select_related("partenaire", "agence")
    serializer_class = CommercialSerializer
    filterset_fields = ["partenaire", "agence", "actif", "telephonique"]
    search_fields = ["nom_complet", "identifiant", "telephone"]

    @action(detail=False, methods=["get"], url_path="moi")
    def moi(self, requete):
        commercial = services.commercial_de(requete.user)
        if commercial is None:
            return Response(
                {
                    "erreur": {
                        "code": "introuvable",
                        "message": "Aucune fiche commerciale n'est rattachee a "
                        "votre compte.",
                        "details": {},
                    }
                },
                status=404,
            )
        return Response(CommercialSerializer(commercial).data)


# --- Campagnes --------------------------------------------------------------


class CampagneViewSet(viewsets.ModelViewSet):
    permission_classes = [EstHabilite, EcritureReserveeAuPilotage]
    queryset = Campagne.objects.select_related("partenaire").prefetch_related(
        "agences", "signataires"
    )
    serializer_class = CampagneSerializer
    filterset_fields = ["partenaire", "statut", "type_campagne", "actif"]
    search_fields = ["nom"]
    ordering_fields = ["date_debut", "nom"]

    @action(detail=False, methods=["get"])
    def ouvertes(self, requete):
        """Les campagnes sur lesquelles je peux saisir aujourd'hui."""
        campagnes = services.campagnes_ouvertes(requete.user)
        return Response(CampagneSerializer(campagnes, many=True).data)

    @action(detail=True, methods=["get"])
    def indicateurs(self, requete, pk=None):
        return Response(services.indicateurs(self.get_object()))

    @action(detail=True, methods=["get"])
    def classement(self, requete, pk=None):
        """Le classement des commerciaux, absents compris."""
        return Response(
            services.classement(
                self.get_object(), requete.query_params.get("periode")
            )
        )

    @action(detail=True, methods=["get"], url_path="agences-perimetre")
    def agences_perimetre(self, requete, pk=None):
        campagne = self.get_object()
        return Response(
            AgenceSerializer(campagne.agences_du_perimetre(), many=True).data
        )

    @action(detail=True, methods=["post"], url_path="calculer-primes")
    def calculer_primes(self, requete, pk=None):
        """Attribue la prime du meilleur vendeur pour une periode."""
        periode = requete.data.get("periode")
        if not periode:
            raise ValidationError({"periode": "Periode attendue au format AAAA-MM."})
        primes = services.calculer_primes(self.get_object(), periode)
        return Response(PrimeSerializer(primes, many=True).data)


class ReponseContratViewSet(viewsets.ModelViewSet):
    permission_classes = [EstHabilite]
    queryset = ReponseContrat.objects.select_related("campagne", "commercial")
    serializer_class = ReponseContratSerializer
    filterset_fields = ["campagne", "commercial", "statut"]

    @action(detail=False, methods=["post"])
    def repondre(self, requete):
        """Le commercial accepte ou refuse le contrat de sa campagne."""
        commercial = services.commercial_de(requete.user)
        if commercial is None:
            raise PermissionDenied("Aucune fiche commerciale rattachee a ce compte.")

        campagne = Campagne.objects.filter(pk=requete.data.get("campagne")).first()
        if campagne is None:
            raise ValidationError({"campagne": "Campagne inconnue."})
        if not campagne.engage(commercial):
            raise PermissionDenied("Vous n'etes pas engage sur cette campagne.")

        statut = requete.data.get("statut")
        if statut not in {
            StatutReponseContrat.ACCEPTE,
            StatutReponseContrat.REFUSE,
        }:
            raise ValidationError({"statut": "Reponse attendue : ACCEPTE ou REFUSE."})
        motif = (requete.data.get("motif_refus") or "").strip()
        if statut == StatutReponseContrat.REFUSE and not motif:
            raise ValidationError({"motif_refus": "Precisez le motif du refus."})

        reponse, _ = ReponseContrat.objects.update_or_create(
            campagne=campagne,
            commercial=commercial,
            defaults={
                "statut": statut,
                "repondu_le": timezone.now(),
                "motif_refus": motif,
            },
        )
        return Response(ReponseContratSerializer(reponse).data)


class VersementAideViewSet(viewsets.ModelViewSet):
    permission_classes = [EstHabilite, EcritureReserveeAuPilotage]
    queryset = VersementAide.objects.select_related("campagne", "commercial")
    serializer_class = VersementAideSerializer
    filterset_fields = ["campagne", "commercial", "semaine_debut"]

    @action(detail=True, methods=["post"])
    def accuser(self, requete, pk=None):
        """Le commercial accuse reception de son aide.

        C'est sa signature : sans elle, un versement conteste ne se prouve pas.
        """
        versement = self.get_object()
        commercial = services.commercial_de(requete.user)
        if commercial is None or versement.commercial_id != commercial.pk:
            raise PermissionDenied("Ce versement ne vous concerne pas.")
        versement.accuse_le = timezone.now()
        versement.save(update_fields=["accuse_le", "modifie_le"])
        return Response(VersementAideSerializer(versement).data)


# --- Terrain ----------------------------------------------------------------


class ClientViewSet(SaisieTerrainMixin, viewsets.ModelViewSet):
    permission_classes = [EstHabilite]
    queryset = Client.objects.select_related("commercial", "agence", "type_carte")
    serializer_class = ClientSerializer
    filterset_fields = ["type_carte", "statut_carte", "agence"]
    search_fields = ["nom", "prenom", "telephone"]

    def get_queryset(self):
        return services.perimetre_des_ventes(super().get_queryset(), self.request.user)


class VenteViewSet(SaisieTerrainMixin, viewsets.ModelViewSet):
    permission_classes = [EstHabilite]
    queryset = Vente.objects.select_related(
        "client", "type_carte", "commercial", "agence", "campagne__partenaire"
    )
    serializer_class = VenteSerializer
    filterset_fields = ["campagne", "type_carte", "statut_activation", "agence"]
    ordering_fields = ["cree_le"]

    def get_queryset(self):
        return services.perimetre_des_ventes(super().get_queryset(), self.request.user)

    @action(detail=False, methods=["get"], url_path="sans-adhesion")
    def sans_adhesion(self, requete):
        """Les ventes dont la fiche d'adhesion manque encore.

        Certains partenaires l'exigent a chaque vente : sans elle, la carte ne
        part pas en fabrication.
        """
        queryset = self.get_queryset().filter(
            adhesion__isnull=True, campagne__partenaire__fiche_adhesion=True
        )
        return Response(self.get_serializer(queryset, many=True).data)


class EnrolementViewSet(SaisieTerrainMixin, viewsets.ModelViewSet):
    permission_classes = [EstHabilite]
    queryset = Enrolement.objects.select_related("commercial", "agence", "campagne")
    serializer_class = EnrolementSerializer
    filterset_fields = ["campagne", "agence"]
    search_fields = ["nom", "prenom", "numero_compte", "telephone"]

    def get_queryset(self):
        return services.perimetre_des_ventes(super().get_queryset(), self.request.user)


class AdhesionCarteViewSet(viewsets.ModelViewSet):
    permission_classes = [EstHabilite]
    queryset = AdhesionCarte.objects.select_related("vente__commercial")
    serializer_class = AdhesionCarteSerializer
    filterset_fields = ["vente"]
    search_fields = ["nom", "prenoms", "piece_numero", "numero_compte"]


class RapportTelephoniqueViewSet(viewsets.ModelViewSet):
    permission_classes = [EstHabilite]
    queryset = RapportTelephonique.objects.select_related("commercial", "campagne")
    serializer_class = RapportTelephoniqueSerializer
    filterset_fields = ["campagne", "date_rapport", "commercial"]
    ordering_fields = ["date_rapport"]

    def get_queryset(self):
        queryset = super().get_queryset()
        utilisateur = self.request.user
        if utilisateur.est_superadmin or utilisateur.a_role(*ROLES_PILOTAGE):
            return queryset
        commercial = services.commercial_de(utilisateur)
        if commercial is None:
            return queryset.none()
        return queryset.filter(commercial=commercial)

    def perform_create(self, serializer):
        commercial = services.commercial_de(self.request.user)
        if commercial is None:
            raise PermissionDenied("Aucune fiche commerciale rattachee a ce compte.")
        serializer.save(commercial=commercial)


class PrimeViewSet(viewsets.ReadOnlyModelViewSet):
    """Les primes se lisent : elles se calculent depuis les ventes."""

    permission_classes = [EstHabilite]
    queryset = Prime.objects.select_related("commercial", "campagne")
    serializer_class = PrimeSerializer
    filterset_fields = ["campagne", "periode", "commercial"]

    def get_queryset(self):
        queryset = super().get_queryset()
        utilisateur = self.request.user
        if utilisateur.est_superadmin or utilisateur.a_role(*ROLES_PILOTAGE):
            return queryset
        commercial = services.commercial_de(utilisateur)
        if commercial is None:
            return queryset.none()
        return queryset.filter(commercial=commercial)


class ReclamationViewSet(viewsets.ModelViewSet):
    permission_classes = [EstHabilite]
    queryset = Reclamation.objects.select_related("client", "commercial")
    serializer_class = ReclamationSerializer
    filterset_fields = ["statut", "type_reclamation", "client"]

    def get_queryset(self):
        queryset = super().get_queryset()
        utilisateur = self.request.user
        if utilisateur.est_superadmin or utilisateur.a_role(*ROLES_PILOTAGE):
            return queryset
        commercial = services.commercial_de(utilisateur)
        if commercial is None:
            return queryset.none()
        return queryset.filter(commercial=commercial)

    def perform_create(self, serializer):
        commercial = services.commercial_de(self.request.user)
        if commercial is None:
            raise PermissionDenied("Aucune fiche commerciale rattachee a ce compte.")
        serializer.save(commercial=commercial)


class TableauDeBord(APIView):
    """Les chiffres du jour, selon ce que la personne a le droit de voir."""

    permission_classes = [EstHabilite]

    def get(self, requete):
        ouvertes = services.campagnes_ouvertes(requete.user)
        ventes = services.perimetre_des_ventes(Vente.objects.all(), requete.user)
        enrolements = services.perimetre_des_ventes(
            Enrolement.objects.all(), requete.user
        )
        aujourdhui = timezone.localdate()

        return Response(
            {
                "campagnes_ouvertes": len(ouvertes),
                "mes_ventes": ventes.count(),
                "mes_ventes_du_jour": ventes.filter(cree_le__date=aujourdhui).count(),
                "mes_enrolements": enrolements.count(),
                "ventes_sans_adhesion": ventes.filter(
                    adhesion__isnull=True, campagne__partenaire__fiche_adhesion=True
                ).count(),
                "reclamations_ouvertes": Reclamation.objects.filter(
                    statut="OUVERTE"
                ).count(),
            }
        )
