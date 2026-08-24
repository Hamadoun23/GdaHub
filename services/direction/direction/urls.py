"""Routes du domaine Direction, montees sous /api/direction/."""

from django.urls import path

from direction.views import Apercu

urlpatterns = [
    path("apercu", Apercu.as_view(), name="apercu"),
]
