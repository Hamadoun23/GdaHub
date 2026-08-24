"""Droits propres aux chantiers.

Trois cercles, du plus large au plus etroit :

- **le partenaire** — un client ou un maitre d'ouvrage exterieur. Il consulte
  le chantier, sans jamais rien ecrire, et sans voir les lignes que GDA garde
  pour elle ;
- **l'equipe** — chef de chantier, ingenieur, controle qualite. Elle saisit
  l'avancement des projets ou elle est affectee ;
- **l'administrateur** — il voit et modifie tout.
"""

from rest_framework import permissions

ROLES_EQUIPE = {"admin", "chef_chantier", "ingenieur", "controle_qualite"}
ROLES_ECRITURE = ROLES_EQUIPE


def est_partenaire(utilisateur) -> bool:
    """Un partenaire, et rien d'autre : le cumul fait pencher vers l'equipe."""
    if utilisateur is None or not utilisateur.is_authenticated:
        return False
    if utilisateur.est_superadmin:
        return False
    return "partenaire" in utilisateur.roles and not (
        set(utilisateur.roles) & ROLES_EQUIPE
    )


class EcritureReserveeALEquipe(permissions.BasePermission):
    message = "Seule l'equipe du chantier peut modifier cet element."

    def has_permission(self, requete, vue):
        if requete.method in permissions.SAFE_METHODS:
            return True
        utilisateur = getattr(requete, "user", None)
        if utilisateur is None or not utilisateur.is_authenticated:
            return False
        return utilisateur.a_role(*ROLES_ECRITURE)
