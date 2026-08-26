"""Routes du domaine Jus d'Orange, montees sous /api/orange/."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from jusorange import views

# Pas de barre oblique finale : les routes ecrites a la main n'en ont pas
# (« /auth/connexion », « /tableau-de-bord »), et melanger les deux
# conventions ferait echouer un POST sur redirection.
routeur = DefaultRouter(trailing_slash=False)
# Recolte
routeur.register("producteurs", views.ProducteurViewSet, basename="producteur")
routeur.register("cueillettes", views.CueilletteViewSet, basename="cueillette")
# Approvisionnement
routeur.register("articles", views.ArticleStockViewSet, basename="article")
routeur.register("receptions", views.ReceptionViewSet, basename="reception")
# Fabrication
routeur.register("productions", views.ProductionViewSet, basename="production")
routeur.register("conditionnements", views.ConditionnementViewSet, basename="conditionnement")
routeur.register("bouteilles", views.BouteilleViewSet, basename="bouteille")
# Entrepot
routeur.register("inventaires", views.InventaireViewSet, basename="inventaire")
# Distribution
routeur.register("clients", views.ClientJusViewSet, basename="client")
routeur.register("ventes", views.VenteViewSet, basename="vente")
routeur.register("commandes", views.CommandeViewSet, basename="commande")
routeur.register("factures", views.FactureViewSet, basename="facture")
routeur.register("paiements", views.PaiementViewSet, basename="paiement")
routeur.register("receptions-paiement", views.ReceptionPaiementViewSet, basename="reception-paiement")
# Prospection
routeur.register("points-vente", views.PointVenteViewSet, basename="point-vente")
routeur.register("visites", views.VisiteViewSet, basename="visite")

urlpatterns = [
    path("tableau-de-bord", views.TableauDeBord.as_view(), name="tableau-de-bord"),
    path("", include(routeur.urls)),
]
