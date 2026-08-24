"""Droits propres a la direction."""

from rest_framework import permissions

#: Le comite de direction et ceux qui parametrent les circuits.
ROLES_DIRECTION = {"membre", "admin"}


class EstDeLaDirection(permissions.BasePermission):
    """Le tableau de bord consolide n'est pas un ecran d'annuaire.

    Il rassemble les chiffres de tout le groupe : masse des depenses du mois,
    dossiers en attente, effectif en conge. Le laisser ouvert reviendrait a
    publier le pilotage de l'entreprise a tout compte habilite.
    """

    message = "Reserve au comite de direction."

    def has_permission(self, requete, vue):
        utilisateur = getattr(requete, "user", None)
        if utilisateur is None or not utilisateur.is_authenticated:
            return False
        return utilisateur.a_role(*ROLES_DIRECTION)
