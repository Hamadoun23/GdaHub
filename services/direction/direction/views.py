"""Vues du domaine Direction : une console, pas un domaine metier."""

from django.utils import timezone
from gdahub_common.permissions import EstHabilite
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from direction import services
from direction.models import SyntheseMensuelle
from direction.permissions import EstDeLaDirection
from direction.serializers import SyntheseMensuelleSerializer


class TableauDeBord(APIView):
    """Les indicateurs de toutes les applications, rassembles en un appel."""

    permission_classes = [EstHabilite, EstDeLaDirection]

    def get(self, requete):
        return Response(
            {
                "date": timezone.localdate(),
                "applications": services.consolider(requete.user),
                "files_d_attente": services.files_d_attente(requete.user),
            }
        )


class Circuits(APIView):
    """Les regles de validation d'une application, lues chez elle.

    Direction n'en garde aucune copie : les lire ici et les modifier la-bas
    ferait diverger les deux des la premiere correction.
    """

    permission_classes = [EstHabilite, EstDeLaDirection]

    def get(self, requete, application):
        return Response(services.circuits_de(application, requete.user))


class SyntheseMensuelleViewSet(viewsets.ModelViewSet):
    """Les photographies mensuelles archivees."""

    permission_classes = [EstHabilite, EstDeLaDirection]
    queryset = SyntheseMensuelle.objects.all()
    serializer_class = SyntheseMensuelleSerializer
    filterset_fields = ["application", "mois"]
    ordering_fields = ["mois", "application"]

    def perform_create(self, serializer):
        serializer.save(construite_par=self.request.user.identifiant)
