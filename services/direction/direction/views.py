"""Vues du domaine Direction.

Le point d'entree ci-dessous ne fait rien de metier : il prouve que la chaine
complete fonctionne — la passerelle route, le jeton signe par identity est
verifie ici, et les roles lus sont bien ceux de l'application direction.
Il disparaitra quand le domaine sera porte.
"""

from django.conf import settings
from rest_framework.response import Response
from rest_framework.views import APIView


class Apercu(APIView):
    """Qui suis-je, et que puis-je faire sur Direction ?"""

    def get(self, requete):
        return Response(
            {
                "service": settings.GDAHUB_APPLICATION,
                "libelle": "Direction",
                "utilisateur": {
                    "id": requete.user.id,
                    "identifiant": requete.user.identifiant,
                    "nom_complet": requete.user.nom_complet,
                },
                "roles": requete.user.roles,
                "est_superadmin": requete.user.est_superadmin,
            }
        )
