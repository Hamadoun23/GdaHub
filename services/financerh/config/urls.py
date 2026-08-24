"""Routes du service financerh."""

from django.urls import include, path

from rhfinance.vues_sante import sante

urlpatterns = [
    path("api/financerh/", include("rhfinance.urls")),
    path("sante", sante, name="sante"),
]
