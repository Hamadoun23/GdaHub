"""Routes du domaine RH & Finance, montees sous /api/financerh/."""

from django.urls import path

from rhfinance.views import Apercu

urlpatterns = [
    path("apercu", Apercu.as_view(), name="apercu"),
]
