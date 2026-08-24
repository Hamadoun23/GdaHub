"""Routes du domaine Ressources humaines, montees sous /api/rh/."""

from django.urls import path

from rh.views import Apercu

urlpatterns = [
    path("apercu", Apercu.as_view(), name="apercu"),
]
