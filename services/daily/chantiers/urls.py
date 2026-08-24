"""Routes du domaine Chantiers, montees sous /api/daily/."""

from django.urls import path

from chantiers.views import Apercu

urlpatterns = [
    path("apercu", Apercu.as_view(), name="apercu"),
]
