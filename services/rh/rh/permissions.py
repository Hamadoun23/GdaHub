"""Droits propres aux ressources humaines."""

from rest_framework import permissions

#: Le back-office RH : parametrer les types, saisir les presences, ouvrir une
#: campagne d'evaluation.
ROLES_ECRITURE = {"gestionnaire", "direction"}


class EstGestionnaire(permissions.BasePermission):
    message = "Reserve aux Ressources Humaines."

    def has_permission(self, requete, vue):
        utilisateur = getattr(requete, "user", None)
        if utilisateur is None or not utilisateur.is_authenticated:
            return False
        return utilisateur.a_role(*ROLES_ECRITURE)


class EcritureReserveeAuxGestionnaires(permissions.BasePermission):
    """Lecture ouverte a tout habilite, ecriture au back-office.

    Un agent gagne a consulter le catalogue des formations ou la liste des
    types de conge ; les modifier engage l'entreprise.
    """

    message = "Seules les Ressources Humaines peuvent modifier cet element."

    def has_permission(self, requete, vue):
        if requete.method in permissions.SAFE_METHODS:
            return True
        utilisateur = getattr(requete, "user", None)
        if utilisateur is None or not utilisateur.is_authenticated:
            return False
        return utilisateur.a_role(*ROLES_ECRITURE)
