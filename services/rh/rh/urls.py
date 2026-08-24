"""Routes du domaine Ressources humaines, montees sous /api/rh/."""

from django.urls import include, path
from gdahub_common.validation.vues import RegleCircuitViewSet
from rest_framework.routers import DefaultRouter

from rh import views

routeur = DefaultRouter()
routeur.register("demandes-absence", views.DemandeAbsenceViewSet, basename="demande-absence")
routeur.register("types-absence", views.TypeAbsenceViewSet, basename="type-absence")
routeur.register("soldes-conges", views.SoldeCongeViewSet, basename="solde-conge")
routeur.register("presences", views.PresenceViewSet, basename="presence")
routeur.register("campagnes", views.CampagneEvaluationViewSet, basename="campagne")
routeur.register("criteres", views.CritereEvaluationViewSet, basename="critere")
routeur.register("evaluations", views.EvaluationViewSet, basename="evaluation")
routeur.register("formations", views.FormationViewSet, basename="formation")
routeur.register("inscriptions", views.InscriptionFormationViewSet, basename="inscription")
# Les regles de circuit de ce service. Le service « direction » les administre
# a travers cette route, avec le jeton du directeur.
routeur.register("circuits", RegleCircuitViewSet, basename="circuit")

urlpatterns = [
    path("tableau-de-bord", views.TableauDeBord.as_view(), name="tableau-de-bord"),
    path("", include(routeur.urls)),
]
