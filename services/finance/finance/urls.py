"""Routes du domaine Finance, montees sous /api/finance/."""

from django.urls import path

from finance.views import Apercu

urlpatterns = [
    path("apercu", Apercu.as_view(), name="apercu"),
]
