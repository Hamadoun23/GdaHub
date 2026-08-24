"""Routes du service planning."""

from django.urls import include, path

from planning.vues_sante import sante

urlpatterns = [
    path("api/planning/", include("planning.urls")),
    path("sante", sante, name="sante"),
]
