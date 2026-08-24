"""Routes du domaine Organisation, montees sous /api/organisation/."""

from django.urls import path

from organisation.views import Apercu

urlpatterns = [
    path("apercu", Apercu.as_view(), name="apercu"),
]
