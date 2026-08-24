"""Routes du domaine Campagnes, montees sous /api/bdm/."""

from django.urls import path

from campagnes.views import Apercu

urlpatterns = [
    path("apercu", Apercu.as_view(), name="apercu"),
]
