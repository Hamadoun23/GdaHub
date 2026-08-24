"""Droits propres a la finance."""

from rest_framework import permissions

#: Le service financier : referentiels, caisses, consultations fournisseurs.
ROLES_ECRITURE = {"gestionnaire", "direction"}


class EstFinancier(permissions.BasePermission):
    message = "Reserve au service financier."

    def has_permission(self, requete, vue):
        utilisateur = getattr(requete, "user", None)
        if utilisateur is None or not utilisateur.is_authenticated:
            return False
        return utilisateur.a_role(*ROLES_ECRITURE)


class EcritureReserveeAuFinancier(permissions.BasePermission):
    """Lecture ouverte a tout habilite, ecriture au service financier.

    Un agent qui depose une depense a besoin de choisir une categorie et un
    fournisseur : lui fermer la lecture du referentiel l'obligerait a saisir
    en clair ce qui est deja normalise.
    """

    message = "Seul le service financier peut modifier cet element."

    def has_permission(self, requete, vue):
        if requete.method in permissions.SAFE_METHODS:
            return True
        utilisateur = getattr(requete, "user", None)
        if utilisateur is None or not utilisateur.is_authenticated:
            return False
        return utilisateur.a_role(*ROLES_ECRITURE)
