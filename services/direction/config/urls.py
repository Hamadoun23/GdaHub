"""Routes du service direction."""

from django.urls import include, path

from direction.vues_sante import sante

urlpatterns = [
    path("api/direction/", include("direction.urls")),
    path("sante", sante, name="sante"),
]
