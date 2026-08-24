"""Routes du service orange."""

from django.urls import include, path

from jusorange.vues_sante import sante

urlpatterns = [
    path("api/orange/", include("jusorange.urls")),
    path("sante", sante, name="sante"),
]
