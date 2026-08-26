"""Routes du domaine Finance, montees sous /api/finance/."""

from django.urls import include, path
from gdahub_common.validation.vues import RegleCircuitViewSet
from rest_framework.routers import DefaultRouter

from finance import views

# Pas de barre oblique finale : les routes ecrites a la main n'en ont pas
# (« /auth/connexion », « /tableau-de-bord »), et melanger les deux
# conventions ferait echouer un POST sur redirection.
routeur = DefaultRouter(trailing_slash=False)
# Referentiels
routeur.register("fournisseurs", views.FournisseurViewSet, basename="fournisseur")
routeur.register("categories", views.CategorieDepenseViewSet, basename="categorie")
routeur.register("baremes", views.BaremePerdiemViewSet, basename="bareme")
# Requisitions
routeur.register("requisitions", views.RequisitionViewSet, basename="requisition")
routeur.register("lignes-requisition", views.LigneRequisitionViewSet, basename="ligne-requisition")
# Achats
routeur.register("demandes-prix", views.DemandePrixViewSet, basename="demande-prix")
routeur.register("offres", views.OffreFournisseurViewSet, basename="offre")
routeur.register("bons-commande", views.BonCommandeViewSet, basename="bon-commande")
# Caisse et depenses
routeur.register("caisses", views.CaisseViewSet, basename="caisse")
routeur.register("approvisionnements", views.ApprovisionnementCaisseViewSet, basename="approvisionnement")
routeur.register("sorties-caisse", views.SortieCaisseViewSet, basename="sortie-caisse")
routeur.register("depenses", views.DepenseViewSet, basename="depense")
# Missions et prestations
routeur.register("missions", views.MissionViewSet, basename="mission")
routeur.register("frais-mission", views.LigneFraisMissionViewSet, basename="frais-mission")
routeur.register("prestations", views.PrestationViewSet, basename="prestation")
# Communication
routeur.register("forfaits", views.ForfaitCommunicationViewSet, basename="forfait")
routeur.register("consommations", views.ConsommationCommunicationViewSet, basename="consommation")
# Regles de circuit de ce service, administrees par « direction ».
routeur.register("circuits", RegleCircuitViewSet, basename="circuit")

urlpatterns = [
    path("tableau-de-bord", views.TableauDeBord.as_view(), name="tableau-de-bord"),
    path("", include(routeur.urls)),
]
