"""Routes du domaine Direction, montees sous /api/direction/."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from direction import views

# Pas de barre oblique finale : les routes ecrites a la main n'en ont pas
# (« /auth/connexion », « /tableau-de-bord »), et melanger les deux
# conventions ferait echouer un POST sur redirection.
routeur = DefaultRouter(trailing_slash=False)
routeur.register("syntheses", views.SyntheseMensuelleViewSet, basename="synthese")

urlpatterns = [
    path("tableau-de-bord", views.TableauDeBord.as_view(), name="tableau-de-bord"),
    path("circuits/<str:application>", views.Circuits.as_view(), name="circuits"),
    path("", include(routeur.urls)),
]
