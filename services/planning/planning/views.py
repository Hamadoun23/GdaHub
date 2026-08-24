"""Vues du domaine Planning."""

from django.utils import timezone
from gdahub_common.permissions import EstHabilite
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from planning import services
from planning.models import (
    Client,
    IdeeContenu,
    Publication,
    RapportClient,
    ReglePublication,
    StatutEcheance,
    Tournage,
)
from planning.serializers import (
    ClientSerializer,
    IdeeContenuSerializer,
    PublicationSerializer,
    RapportClientSerializer,
    ReglePublicationSerializer,
    TournageSerializer,
)

#: Qui travaille le planning, par opposition au client qui le consulte.
ROLES_EQUIPE = {"admin", "team"}


class EcritureReserveeALEquipe(permissions.BasePermission):
    """Un client consulte son planning ; il ne le modifie pas.

    C'est l'equipe de GDA qui engage l'entreprise sur une date : laisser un
    client deplacer un tournage reviendrait a lui laisser fixer le plan de
    charge du studio.
    """

    message = "Seule l'equipe du planning peut modifier cet element."

    def has_permission(self, requete, vue):
        if requete.method in permissions.SAFE_METHODS:
            return True
        utilisateur = getattr(requete, "user", None)
        if utilisateur is None or not utilisateur.is_authenticated:
            return False
        return utilisateur.a_role(*ROLES_EQUIPE)


class ClientViewSet(viewsets.ModelViewSet):
    permission_classes = [EstHabilite, EcritureReserveeALEquipe]
    queryset = Client.objects.prefetch_related("regles")
    serializer_class = ClientSerializer
    filterset_fields = ["actif"]
    search_fields = ["nom_entreprise", "contact", "email"]

    def get_queryset(self):
        return services.clients_visibles(super().get_queryset(), self.request.user)

    @action(detail=True, methods=["get"])
    def statistiques(self, requete, pk=None):
        """Le bilan du client pour un mois donne."""
        client = self.get_object()
        aujourdhui = timezone.localdate()
        mois = int(requete.query_params.get("mois", aujourdhui.month))
        annee = int(requete.query_params.get("annee", aujourdhui.year))
        return Response(services.statistiques(client, mois, annee))


class ReglePublicationViewSet(viewsets.ModelViewSet):
    permission_classes = [EstHabilite, EcritureReserveeALEquipe]
    queryset = ReglePublication.objects.select_related("client")
    serializer_class = ReglePublicationSerializer
    filterset_fields = ["client", "jour"]


class IdeeContenuViewSet(viewsets.ModelViewSet):
    """Le vivier d'idees, partage par tous les clients."""

    permission_classes = [EstHabilite, EcritureReserveeALEquipe]
    queryset = IdeeContenu.objects.all()
    serializer_class = IdeeContenuSerializer
    filterset_fields = ["type_contenu"]
    search_fields = ["titre", "notes"]


class TournageViewSet(viewsets.ModelViewSet):
    permission_classes = [EstHabilite, EcritureReserveeALEquipe]
    queryset = Tournage.objects.select_related("client").prefetch_related("idees")
    serializer_class = TournageSerializer
    filterset_fields = ["client", "statut", "date"]
    ordering_fields = ["date"]

    def get_queryset(self):
        return services.filtrer_pour(super().get_queryset(), self.request.user)

    @action(detail=False, methods=["get"], url_path="en-retard")
    def en_retard(self, requete):
        """Les tournages dont l'echeance est passee sans rien.

        C'est le seul chiffre qu'un client regarde vraiment : il merite sa
        propre route plutot que d'etre reconstitue a chaque affichage.
        """
        queryset = self.get_queryset().filter(
            statut=StatutEcheance.EN_ATTENTE, date__lt=timezone.localdate()
        )
        return Response(self.get_serializer(queryset, many=True).data)


class PublicationViewSet(viewsets.ModelViewSet):
    permission_classes = [EstHabilite, EcritureReserveeALEquipe]
    queryset = Publication.objects.select_related("client", "idee", "tournage")
    serializer_class = PublicationSerializer
    filterset_fields = ["client", "statut", "date", "idee"]
    ordering_fields = ["date"]

    def get_queryset(self):
        return services.filtrer_pour(super().get_queryset(), self.request.user)

    @action(detail=False, methods=["get"], url_path="en-retard")
    def en_retard(self, requete):
        queryset = self.get_queryset().filter(
            statut=StatutEcheance.EN_ATTENTE, date__lt=timezone.localdate()
        )
        return Response(self.get_serializer(queryset, many=True).data)


class RapportClientViewSet(viewsets.ModelViewSet):
    permission_classes = [EstHabilite, EcritureReserveeALEquipe]
    queryset = RapportClient.objects.select_related("client")
    serializer_class = RapportClientSerializer
    filterset_fields = ["client", "mois", "annee"]

    def get_queryset(self):
        return services.filtrer_pour(super().get_queryset(), self.request.user)

    @action(detail=False, methods=["post"])
    def construire(self, requete):
        """Fige le bilan du mois pour un client."""
        client_id = requete.data.get("client")
        client = Client.objects.filter(pk=client_id).first()
        if client is None:
            raise ValidationError({"client": "Client inconnu."})
        aujourdhui = timezone.localdate()
        rapport = services.construire_rapport(
            client,
            int(requete.data.get("mois", aujourdhui.month)),
            int(requete.data.get("annee", aujourdhui.year)),
            requete.user,
        )
        return Response(RapportClientSerializer(rapport).data)

    @action(detail=True, methods=["post"])
    def telecharger(self, requete, pk=None):
        rapport = self.get_object()
        rapport.compter_telechargement()
        return Response(RapportClientSerializer(rapport).data)


class Calendrier(APIView):
    """Le planning du mois, jour par jour, en un seul appel."""

    permission_classes = [EstHabilite]

    def get(self, requete):
        aujourdhui = timezone.localdate()
        client = requete.query_params.get("client")
        return Response(
            services.calendrier(
                int(requete.query_params.get("mois", aujourdhui.month)),
                int(requete.query_params.get("annee", aujourdhui.year)),
                requete.user,
                int(client) if client else None,
            )
        )


class TableauDeBord(APIView):
    permission_classes = [EstHabilite]

    def get(self, requete):
        aujourdhui = timezone.localdate()
        tournages = services.filtrer_pour(Tournage.objects.all(), requete.user)
        publications = services.filtrer_pour(Publication.objects.all(), requete.user)
        return Response(
            {
                "clients": services.clients_visibles(
                    Client.objects.filter(actif=True), requete.user
                ).count(),
                "tournages_en_retard": tournages.filter(
                    statut=StatutEcheance.EN_ATTENTE, date__lt=aujourdhui
                ).count(),
                "publications_en_retard": publications.filter(
                    statut=StatutEcheance.EN_ATTENTE, date__lt=aujourdhui
                ).count(),
                "a_venir": tournages.filter(
                    statut=StatutEcheance.EN_ATTENTE, date__gte=aujourdhui
                ).count()
                + publications.filter(
                    statut=StatutEcheance.EN_ATTENTE, date__gte=aujourdhui
                ).count(),
            }
        )
