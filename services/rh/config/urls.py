"""Routes du service rh."""

from django.urls import include, path

from rh.vues_sante import sante

urlpatterns = [
    path("api/rh/", include("rh.urls")),
    path("sante", sante, name="sante"),
]
