"""Routes du domaine Direction, montees sous /api/direction/."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from direction import views

routeur = DefaultRouter()
routeur.register("syntheses", views.SyntheseMensuelleViewSet, basename="synthese")

urlpatterns = [
    path("tableau-de-bord", views.TableauDeBord.as_view(), name="tableau-de-bord"),
    path("circuits/<str:application>", views.Circuits.as_view(), name="circuits"),
    path("", include(routeur.urls)),
]
