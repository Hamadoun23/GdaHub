"""Routes du domaine Organisation, montees sous /api/organisation/."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from organisation import views

# Pas de barre oblique finale : les routes ecrites a la main n'en ont pas
# (« /auth/connexion », « /tableau-de-bord »), et melanger les deux
# conventions ferait echouer un POST sur redirection.
routeur = DefaultRouter(trailing_slash=False)
routeur.register("agents", views.AgentViewSet, basename="agent")
routeur.register("departements", views.DepartementViewSet, basename="departement")

urlpatterns = [
    path("ma-fiche", views.MaFiche.as_view(), name="ma-fiche"),
    path("mon-contexte", views.MonContexte.as_view(), name="mon-contexte"),
    path("organigramme", views.Organigramme.as_view(), name="organigramme"),
    path("", include(routeur.urls)),
]
