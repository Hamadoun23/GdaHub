"""Routes du service daily."""

from django.urls import include, path

from chantiers.vues_sante import sante

urlpatterns = [
    path("api/daily/", include("chantiers.urls")),
    path("sante", sante, name="sante"),
]
