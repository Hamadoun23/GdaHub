"""Droits propres a l'organigramme."""

from rest_framework import permissions

#: Modifier l'organigramme, c'est deplacer le valideur des demandes de
#: quelqu'un. Deux roles seulement en ont le droit.
ROLES_ECRITURE = {"admin", "gestionnaire"}


class EcritureReserveeAuxGestionnaires(permissions.BasePermission):
    """Lecture ouverte a tout habilite, ecriture aux gestionnaires.

    L'annuaire interne se consulte librement : le rendre confidentiel
    pousserait chacun a s'en refaire un dans un tableur, et c'est ce doublon
    qu'on cherche precisement a supprimer.
    """

    message = "Seuls les gestionnaires de l'organigramme peuvent le modifier."

    def has_permission(self, requete, vue):
        if requete.method in permissions.SAFE_METHODS:
            return True
        utilisateur = getattr(requete, "user", None)
        if utilisateur is None or not utilisateur.is_authenticated:
            return False
        return utilisateur.a_role(*ROLES_ECRITURE)
