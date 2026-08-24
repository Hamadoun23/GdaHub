"""Vues du domaine Organisation.

Deux niveaux de droit, et deux seulement :

- **lire** — tout compte habilite sur l'application. L'annuaire interne n'a
  pas a etre secret, et le rendre confidentiel pousserait chacun a s'en
  refaire un dans un tableur.
- **ecrire** — les roles `admin` et `gestionnaire`. Modifier un rattachement,
  c'est deplacer le valideur des demandes de quelqu'un : ce n'est pas un geste
  d'annuaire.
"""

from django.db.models import Q
from gdahub_common.permissions import EstHabilite
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from organisation import services
from organisation.models import Agent, Departement
from organisation.permissions import EcritureReserveeAuxGestionnaires
from organisation.serializers import (
    AgentResumeSerializer,
    AgentSerializer,
    DepartementSerializer,
    FicheSerializer,
)

INTROUVABLE = {
    "erreur": {
        "code": "introuvable",
        "message": "Aucune fiche d'agent n'est rattachee a votre compte. "
        "Signalez-le aux Ressources Humaines.",
        "details": {},
    }
}


class DepartementViewSet(viewsets.ModelViewSet):
    """Les unites de l'organigramme."""

    permission_classes = [EstHabilite, EcritureReserveeAuxGestionnaires]
    queryset = Departement.objects.select_related("responsable").all()
    serializer_class = DepartementSerializer
    filterset_fields = ["actif"]
    search_fields = ["code", "nom"]
    ordering_fields = ["nom", "code"]

    def perform_destroy(self, instance):
        """Un departement se desactive, il ne se supprime pas.

        Des demandes validees le citent dans quatre autres bases, sous forme
        d'instantanes. Le faire disparaitre laisserait ces traces sans
        reference.
        """
        instance.actif = False
        instance.save(update_fields=["actif", "modifie_le"])


class AgentViewSet(viewsets.ModelViewSet):
    """L'annuaire du groupe."""

    permission_classes = [EstHabilite, EcritureReserveeAuxGestionnaires]
    queryset = Agent.objects.select_related("departement", "responsable").all()
    serializer_class = AgentSerializer
    filterset_fields = ["departement", "type_contrat", "actif"]
    search_fields = ["nom", "prenom", "matricule", "poste", "email", "identifiant"]
    ordering_fields = ["nom", "date_embauche", "matricule"]

    def perform_destroy(self, instance):
        """Une sortie se declare, elle ne s'efface pas.

        L'historique des conges et des depenses d'un agent parti doit rester
        consultable : c'est la memoire de l'entreprise, et parfois une piece
        dans un litige.
        """
        instance.actif = False
        instance.save(update_fields=["actif", "modifie_le"])

    @action(detail=False, methods=["get"], url_path="mon-equipe")
    def mon_equipe(self, requete):
        """Les agents rattaches a la personne connectee."""
        agent = services.fiche_du_porteur(requete.user)
        if agent is None:
            return Response(INTROUVABLE, status=status.HTTP_404_NOT_FOUND)
        equipe = self.get_queryset().filter(responsable=agent, actif=True)
        return Response(AgentSerializer(equipe, many=True).data)

    @action(detail=False, methods=["get"])
    def encadrants(self, requete):
        """Les agents a qui d'autres sont rattaches.

        Le service `direction` s'en sert pour construire ses circuits : c'est
        la seule liste de valideurs que l'organigramme sache produire, les
        autres relevant des habilitations et donc d'identity.
        """
        agents = (
            self.get_queryset()
            .filter(actif=True)
            .filter(Q(equipe__actif=True) | Q(departements_diriges__isnull=False))
            .distinct()
        )
        return Response(AgentResumeSerializer(agents, many=True).data)

    @action(detail=True, methods=["get"])
    def hierarchie(self, requete, pk=None):
        """La suite des responsables au-dessus d'un agent."""
        chaine = services.chaine_hierarchique(self.get_object())
        return Response(AgentResumeSerializer(chaine, many=True).data)

    @action(detail=True, methods=["get"])
    def instantane(self, requete, pk=None):
        """Les champs qu'un autre service recopie a cote de sa donnee metier.

        C'est le contrat inter-services, volontairement expose comme une route
        a part : le jour ou il change, on sait exactement qui le lit.
        """
        return Response(self.get_object().instantane())


class MaFiche(APIView):
    """La fiche de la personne connectee.

    C'est aussi le point ou la fiche et le compte se rejoignent : au premier
    appel, l'identifiant du jeton retrouve la fiche importee et le lien est
    etabli, sans qu'aucun service ait eu a en interroger un autre.
    """

    permission_classes = [EstHabilite]

    def get(self, requete):
        agent = services.fiche_du_porteur(requete.user)
        if agent is None:
            return Response(INTROUVABLE, status=status.HTTP_404_NOT_FOUND)
        return Response(FicheSerializer(agent).data)

    def patch(self, requete):
        agent = services.fiche_du_porteur(requete.user)
        if agent is None:
            return Response(INTROUVABLE, status=status.HTTP_404_NOT_FOUND)
        formulaire = FicheSerializer(agent, data=requete.data, partial=True)
        formulaire.is_valid(raise_exception=True)
        formulaire.save()
        return Response(formulaire.data)


class Organigramme(APIView):
    """L'arbre des rattachements, du sommet aux equipes."""

    permission_classes = [EstHabilite]

    def get(self, requete):
        return Response({"racines": services.organigramme()})
