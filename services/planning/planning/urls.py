"""Routes du domaine Planning, montees sous /api/planning/."""

from django.urls import path

from planning.views import Apercu

urlpatterns = [
    path("apercu", Apercu.as_view(), name="apercu"),
]
