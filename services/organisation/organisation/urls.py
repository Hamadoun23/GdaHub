"""Routes du domaine Organisation, montees sous /api/organisation/."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from organisation import views

routeur = DefaultRouter()
routeur.register("agents", views.AgentViewSet, basename="agent")
routeur.register("departements", views.DepartementViewSet, basename="departement")

urlpatterns = [
    path("ma-fiche", views.MaFiche.as_view(), name="ma-fiche"),
    path("organigramme", views.Organigramme.as_view(), name="organigramme"),
    path("", include(routeur.urls)),
]
