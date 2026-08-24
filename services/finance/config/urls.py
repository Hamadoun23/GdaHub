"""Routes du service finance."""

from django.urls import include, path

from finance.vues_sante import sante

urlpatterns = [
    path("api/finance/", include("finance.urls")),
    path("sante", sante, name="sante"),
]
