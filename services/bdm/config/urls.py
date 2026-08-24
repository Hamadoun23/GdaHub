"""Routes du service bdm."""

from django.urls import include, path

from campagnes.vues_sante import sante

urlpatterns = [
    path("api/bdm/", include("campagnes.urls")),
    path("sante", sante, name="sante"),
]
