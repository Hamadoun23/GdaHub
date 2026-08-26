"""Routes du domaine Campagnes, montees sous /api/bdm/."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from campagnes import views

# Pas de barre oblique finale : les routes ecrites a la main n'en ont pas
# (« /auth/connexion », « /tableau-de-bord »), et melanger les deux
# conventions ferait echouer un POST sur redirection.
routeur = DefaultRouter(trailing_slash=False)
# Referentiels
routeur.register("partenaires", views.PartenaireViewSet, basename="partenaire")
routeur.register("agences", views.AgenceViewSet, basename="agence")
routeur.register("types-cartes", views.TypeCarteViewSet, basename="type-carte")
routeur.register("commerciaux", views.CommercialViewSet, basename="commercial")
# Campagnes
routeur.register("campagnes", views.CampagneViewSet, basename="campagne")
routeur.register("contrats", views.ReponseContratViewSet, basename="contrat")
routeur.register("aides", views.VersementAideViewSet, basename="aide")
# Terrain
routeur.register("clients", views.ClientViewSet, basename="client")
routeur.register("ventes", views.VenteViewSet, basename="vente")
routeur.register("enrolements", views.EnrolementViewSet, basename="enrolement")
routeur.register("adhesions", views.AdhesionCarteViewSet, basename="adhesion")
routeur.register("rapports-telephoniques", views.RapportTelephoniqueViewSet, basename="rapport-telephonique")
routeur.register("primes", views.PrimeViewSet, basename="prime")
routeur.register("reclamations", views.ReclamationViewSet, basename="reclamation")

urlpatterns = [
    path("tableau-de-bord", views.TableauDeBord.as_view(), name="tableau-de-bord"),
    path("", include(routeur.urls)),
]
