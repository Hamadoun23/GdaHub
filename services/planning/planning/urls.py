"""Routes du domaine Planning, montees sous /api/planning/."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from planning import views

# Pas de barre oblique finale : les routes ecrites a la main n'en ont pas
# (« /auth/connexion », « /tableau-de-bord »), et melanger les deux
# conventions ferait echouer un POST sur redirection.
routeur = DefaultRouter(trailing_slash=False)
routeur.register("clients", views.ClientViewSet, basename="client")
routeur.register("regles", views.ReglePublicationViewSet, basename="regle")
routeur.register("idees", views.IdeeContenuViewSet, basename="idee")
routeur.register("tournages", views.TournageViewSet, basename="tournage")
routeur.register("publications", views.PublicationViewSet, basename="publication")
routeur.register("rapports", views.RapportClientViewSet, basename="rapport")

urlpatterns = [
    path("calendrier", views.Calendrier.as_view(), name="calendrier"),
    path("tableau-de-bord", views.TableauDeBord.as_view(), name="tableau-de-bord"),
    path("", include(routeur.urls)),
]
