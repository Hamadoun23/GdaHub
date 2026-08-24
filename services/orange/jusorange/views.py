"""Vues du domaine Jus d'Orange.

Les roles suivent la chaine de production : un responsable de production ne
touche pas aux factures, un commercial ne modifie pas une recette. Ce n'est
pas de la mefiance, c'est ce qui rend une piste de controle sanitaire ou
comptable exploitable.
"""

from django.db.models import Sum
from django.utils import timezone
from gdahub_common.permissions import EstHabilite
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from jusorange import services
from jusorange.models import (
    ArticleStock,
    Bouteille,
    ClientJus,
    Commande,
    Conditionnement,
    Cueillette,
    Facture,
    Inventaire,
    Paiement,
    PointVente,
    Producteur,
    Production,
    Reception,
    ReceptionPaiement,
    StatutBouteille,
    StatutFacture,
    Vente,
    Visite,
)
from jusorange.serializers import (
    ArticleStockSerializer,
    BouteilleSerializer,
    ClientJusSerializer,
    CommandeSerializer,
    ConditionnementSerializer,
    CueilletteSerializer,
    FactureSerializer,
    InventaireSerializer,
    PaiementSerializer,
    PointVenteSerializer,
    ProducteurSerializer,
    ProductionSerializer,
    ReceptionPaiementSerializer,
    ReceptionSerializer,
    VenteSerializer,
    VisiteSerializer,
)

#: Qui peut ecrire quoi. « admin » et « direction » passent partout.
ROLES_PRODUCTION = {"admin", "direction", "responsable_production"}
ROLES_COMMERCE = {"admin", "direction", "commercial"}
ROLES_FINANCE = {"admin", "direction", "finance"}


class ReservePour(permissions.BasePermission):
    """Lecture ouverte a tout habilite, ecriture aux roles listes par la vue."""

    message = "Votre role ne permet pas de modifier cet element."

    def has_permission(self, requete, vue):
        if requete.method in permissions.SAFE_METHODS:
            return True
        utilisateur = getattr(requete, "user", None)
        if utilisateur is None or not utilisateur.is_authenticated:
            return False
        return utilisateur.a_role(*getattr(vue, "roles_ecriture", ()))


class BaseViewSet(viewsets.ModelViewSet):
    permission_classes = [EstHabilite, ReservePour]
    roles_ecriture: set = ROLES_PRODUCTION


# --- Recolte ----------------------------------------------------------------


class ProducteurViewSet(BaseViewSet):
    queryset = Producteur.objects.all()
    serializer_class = ProducteurSerializer
    filterset_fields = ["type_producteur", "actif", "zone"]
    search_fields = ["nom_complet", "zone", "contact"]


class CueilletteViewSet(BaseViewSet):
    queryset = Cueillette.objects.select_related("producteur")
    serializer_class = CueilletteSerializer
    filterset_fields = ["producteur", "date_cueillette"]
    ordering_fields = ["date_cueillette", "quantite_totale"]


# --- Approvisionnement ------------------------------------------------------


class ArticleStockViewSet(BaseViewSet):
    queryset = ArticleStock.objects.all()
    serializer_class = ArticleStockSerializer
    filterset_fields = ["type_article"]

    @action(detail=False, methods=["get"], url_path="sous-alerte")
    def sous_alerte(self, requete):
        articles = [
            article for article in self.get_queryset() if article.sous_alerte
        ]
        return Response(ArticleStockSerializer(articles, many=True).data)


class ReceptionViewSet(BaseViewSet):
    queryset = Reception.objects.select_related("cueillette", "producteur_externe")
    serializer_class = ReceptionSerializer
    filterset_fields = ["date_reception", "cueillette", "producteur_externe"]
    ordering_fields = ["date_reception", "quantite_recue"]

    def perform_create(self, serializer):
        serializer.save()
        services.recalculer_stock_oranges()

    def perform_update(self, serializer):
        serializer.save()
        # Le stock est un cumul : une correction doit le refaire, sinon il
        # reste faux jusqu'au prochain inventaire.
        services.recalculer_stock_oranges()

    def perform_destroy(self, instance):
        instance.delete()
        services.recalculer_stock_oranges()


# --- Fabrication et conditionnement -----------------------------------------


class ProductionViewSet(BaseViewSet):
    queryset = Production.objects.all()
    serializer_class = ProductionSerializer
    filterset_fields = ["statut", "recette", "date_production", "test_qualite"]
    ordering_fields = ["date_production"]
    search_fields = ["numero"]

    def perform_create(self, serializer):
        serializer.save(
            agent_identifiant=self.request.user.identifiant,
            agent_nom=self.request.user.nom_complet,
        )


class ConditionnementViewSet(BaseViewSet):
    queryset = Conditionnement.objects.select_related("production").prefetch_related(
        "bouteilles"
    )
    serializer_class = ConditionnementSerializer
    filterset_fields = ["production", "date_conditionnement"]

    def perform_create(self, serializer):
        conditionnement = serializer.save(
            agent_identifiant=self.request.user.identifiant,
            agent_nom=self.request.user.nom_complet,
        )
        services.produire_bouteilles(conditionnement)


class BouteilleViewSet(BaseViewSet):
    queryset = Bouteille.objects.select_related("conditionnement")
    serializer_class = BouteilleSerializer
    filterset_fields = ["statut", "format_litre", "conditionnement", "commande"]
    search_fields = ["code_barre"]

    @action(detail=False, methods=["get"], url_path="perimees")
    def perimees(self, requete):
        """Les bouteilles a retirer du stock.

        C'est la maille du rappel de lot : sans elle, une DLC depassee
        obligerait a retirer toute la production du mois.
        """
        queryset = self.get_queryset().filter(
            statut=StatutBouteille.DISPONIBLE, date_limite__lt=timezone.localdate()
        )
        return Response(self.get_serializer(queryset, many=True).data)


# --- Entrepot ---------------------------------------------------------------


class InventaireViewSet(BaseViewSet):
    queryset = Inventaire.objects.select_related("article")
    serializer_class = InventaireSerializer
    filterset_fields = ["article", "statut", "qualite", "date_inventaire"]
    ordering_fields = ["date_inventaire"]

    def perform_create(self, serializer):
        serializer.save(
            agent_identifiant=self.request.user.identifiant,
            agent_nom=self.request.user.nom_complet,
        )


# --- Distribution -----------------------------------------------------------


class ClientJusViewSet(BaseViewSet):
    roles_ecriture = ROLES_COMMERCE
    queryset = ClientJus.objects.all()
    serializer_class = ClientJusSerializer
    filterset_fields = ["actif"]
    search_fields = ["nom_complet", "telephone", "email"]


class VenteViewSet(BaseViewSet):
    roles_ecriture = ROLES_COMMERCE
    queryset = Vente.objects.select_related("client").prefetch_related(
        "factures__paiements"
    )
    serializer_class = VenteSerializer
    filterset_fields = ["client", "mode", "date_vente"]
    ordering_fields = ["date_vente", "montant_total"]


class CommandeViewSet(BaseViewSet):
    roles_ecriture = ROLES_COMMERCE
    queryset = Commande.objects.select_related("client", "vente")
    serializer_class = CommandeSerializer
    filterset_fields = ["client", "vente", "date_commande"]


class FactureViewSet(BaseViewSet):
    roles_ecriture = ROLES_FINANCE
    queryset = Facture.objects.select_related("vente__client").prefetch_related(
        "paiements"
    )
    serializer_class = FactureSerializer
    filterset_fields = ["statut", "vente", "date_facture"]
    search_fields = ["numero"]
    ordering_fields = ["date_facture", "date_echeance", "montant"]

    @action(detail=False, methods=["get"], url_path="impayees")
    def impayees(self, requete):
        """Ce qui reste a encaisser, echeance depassee en tete."""
        queryset = self.get_queryset().exclude(
            statut__in=[StatutFacture.SOLDEE, StatutFacture.ANNULEE]
        ).order_by("date_echeance")
        return Response(self.get_serializer(queryset, many=True).data)


class PaiementViewSet(BaseViewSet):
    roles_ecriture = ROLES_FINANCE
    queryset = Paiement.objects.select_related("facture")
    serializer_class = PaiementSerializer
    filterset_fields = ["facture", "mode", "date_paiement"]


class ReceptionPaiementViewSet(BaseViewSet):
    roles_ecriture = ROLES_FINANCE
    queryset = ReceptionPaiement.objects.select_related("paiement__facture")
    serializer_class = ReceptionPaiementSerializer
    filterset_fields = ["statut", "ecart_traite"]

    @action(detail=False, methods=["get"], url_path="ecarts")
    def ecarts(self, requete):
        """Les encaissements qui ne tombent pas juste.

        C'est le point de controle du domaine : sans lui, un manquant se
        noierait dans les comptes.
        """
        queryset = self.get_queryset().exclude(statut="CONFORME").filter(
            ecart_traite=False
        )
        return Response(self.get_serializer(queryset, many=True).data)


# --- Prospection ------------------------------------------------------------


class PointVenteViewSet(BaseViewSet):
    roles_ecriture = ROLES_COMMERCE
    queryset = PointVente.objects.prefetch_related("visites")
    serializer_class = PointVenteSerializer
    filterset_fields = ["statut", "type_point", "zone"]
    search_fields = ["nom", "contact", "adresse"]


class VisiteViewSet(BaseViewSet):
    roles_ecriture = ROLES_COMMERCE
    queryset = Visite.objects.select_related("point_vente")
    serializer_class = VisiteSerializer
    filterset_fields = ["point_vente", "date_visite", "commercial_identifiant"]
    ordering_fields = ["date_visite"]

    def perform_create(self, serializer):
        serializer.save(
            commercial_identifiant=self.request.user.identifiant,
            commercial_nom=self.request.user.nom_complet,
        )

    @action(detail=False, methods=["get"], url_path="a-relancer")
    def a_relancer(self, requete):
        """Les points de vente dont la prochaine visite est due."""
        queryset = self.get_queryset().filter(
            prochaine_visite__lte=timezone.localdate()
        )
        return Response(self.get_serializer(queryset, many=True).data)


class TableauDeBord(APIView):
    """La chaine complete en un coup d'oeil, de la cueillette a l'encaissement."""

    permission_classes = [EstHabilite]

    def get(self, requete):
        aujourdhui = timezone.localdate()
        debut_mois = aujourdhui.replace(day=1)

        return Response(
            {
                "oranges_en_stock": services.stock_de("ORANGE"),
                "receptions_du_mois": Reception.objects.filter(
                    date_reception__gte=debut_mois
                ).aggregate(total=Sum("quantite_bonne"))["total"]
                or 0,
                "productions_en_cours": Production.objects.filter(
                    statut="EN_COURS"
                ).count(),
                "bouteilles_disponibles": Bouteille.objects.filter(
                    statut=StatutBouteille.DISPONIBLE
                ).count(),
                "bouteilles_perimees": Bouteille.objects.filter(
                    statut=StatutBouteille.DISPONIBLE,
                    date_limite__lt=aujourdhui,
                ).count(),
                "factures_impayees": Facture.objects.exclude(
                    statut__in=[StatutFacture.SOLDEE, StatutFacture.ANNULEE]
                ).count(),
                "ecarts_de_caisse": ReceptionPaiement.objects.exclude(
                    statut="CONFORME"
                )
                .filter(ecart_traite=False)
                .count(),
                "articles_sous_alerte": sum(
                    1 for article in ArticleStock.objects.all() if article.sous_alerte
                ),
            }
        )
