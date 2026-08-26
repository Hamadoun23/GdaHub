"""Routes du domaine Chantiers, montees sous /api/daily/."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from chantiers import views

# Pas de barre oblique finale : les routes ecrites a la main n'en ont pas
# (« /auth/connexion », « /tableau-de-bord »), et melanger les deux
# conventions ferait echouer un POST sur redirection.
routeur = DefaultRouter(trailing_slash=False)
routeur.register("projets", views.ProjetViewSet, basename="projet")
routeur.register("phases", views.PhaseViewSet, basename="phase")
routeur.register("sous-phases", views.SousPhaseViewSet, basename="sous-phase")
routeur.register("taches", views.TacheViewSet, basename="tache")
routeur.register("saisies", views.MiseAJourViewSet, basename="saisie")
routeur.register("photos", views.PhotoViewSet, basename="photo")
routeur.register("rapports", views.RapportViewSet, basename="rapport")
routeur.register("journal", views.JournalViewSet, basename="journal")

urlpatterns = [
    path("tableau-de-bord", views.TableauDeBord.as_view(), name="tableau-de-bord"),
    path("", include(routeur.urls)),
]
