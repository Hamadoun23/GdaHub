"""Routes du domaine Jus d'Orange, montees sous /api/orange/."""

from django.urls import path

from jusorange.views import Apercu

urlpatterns = [
    path("apercu", Apercu.as_view(), name="apercu"),
]
