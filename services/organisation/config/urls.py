"""Routes du service organisation."""

from django.urls import include, path

from organisation.vues_sante import sante

urlpatterns = [
    path("api/organisation/", include("organisation.urls")),
    path("sante", sante, name="sante"),
]
