"""Rattachement au compte unique de GDA Hub.

BDM tourne sur `bdm.gdamali.net` avec sa propre connexion, et cela ne change
pas. Servie par la passerelle de GDA Hub, elle reconnait **en plus** le compte
unique : un agent deja connecte au hub entre dans BDM sans ressaisir son mot
de passe.

**Pourquoi un middleware et non une classe d'authentification.** BDM n'est pas
une API : Django sert lui-meme les pages React, par Inertia, et la session
tient l'identite. Il n'y a donc pas de requete portant un en-tete a inspecter
au niveau de DRF - il y a une navigation, avec des cookies. Le rattachement se
fait donc au moment ou la requete entre.

C'est la passerelle qui transforme le cookie du hub en en-tete `Authorization`
avant de transmettre la requete : le cookie reste inaccessible au JavaScript,
et BDM n'a qu'un en-tete a lire.

Les trois memes regles qu'ailleurs :

**Le hub s'ajoute, il ne remplace pas.** Une session BDM deja ouverte est
respectee telle quelle. Si le hub tombe, la connexion maison fonctionne
toujours.

**Sans configuration, ce module est inerte.**

**Le hub donne une identite, pas une autorisation.** Un jeton valide sans
compte BDM correspondant laisse la requete anonyme, et l'utilisateur arrive
sur l'ecran de connexion habituel. Creer le compte a la volee lui donnerait un
role vide - et dans BDM, le role decide de tout.
"""

import logging

from django.conf import settings
from django.contrib.auth import get_user_model, login

#: Le code de cette application dans GDA Hub. C'est la cle sous
#: laquelle le jeton porte l'identifiant local de la personne.
APPLICATION = "bdm"

journal = logging.getLogger("bdm.hub")

_CLIENT_JWKS = None


def _client_jwks():
    """Le client JWKS, construit une seule fois."""
    global _CLIENT_JWKS
    if _CLIENT_JWKS is None:
        from jwt import PyJWKClient

        _CLIENT_JWKS = PyJWKClient(settings.GDAHUB_JWKS_URL, cache_keys=True)
    return _CLIENT_JWKS


def _identifiant_du_jeton(jeton):
    """L'adresse portee par un jeton du hub, ou None s'il ne vaut rien."""
    import jwt

    try:
        if jwt.get_unverified_header(jeton).get("alg") != "RS256":
            return None
        cle = _client_jwks().get_signing_key_from_jwt(jeton)
        charge = jwt.decode(
            jeton,
            cle.key,
            algorithms=["RS256"],
            issuer=settings.GDAHUB_JETON_EMETTEUR,
            audience=settings.GDAHUB_JETON_AUDIENCE,
        )
    except Exception:
        # Un jeton illisible n'est pas une erreur a remonter : la requete
        # poursuit son chemin en anonyme et tombera sur l'ecran de connexion.
        return None
    # Le hub identifie par l'adresse professionnelle ; BDM connait ses
    # utilisateurs sous des adresses fabriquees lors de la reprise depuis
    # Laravel. La correspondance, quand elle existe, prime sur l'adresse.
    locaux = charge.get("identifiants_locaux") or {}
    identifiant = (
        locaux.get(APPLICATION) or charge.get("identifiant") or ""
    ).strip().lower()
    return identifiant or None


class AuthentificationHub:
    """Ouvre la session BDM d'un agent deja connecte a GDA Hub."""

    def __init__(self, suivant):
        self.suivant = suivant

    def __call__(self, requete):
        if getattr(settings, "GDAHUB_JWKS_URL", "") and not requete.user.is_authenticated:
            self._rattacher(requete)
        return self.suivant(requete)

    def _rattacher(self, requete):
        entete = requete.META.get("HTTP_AUTHORIZATION", "")
        if not entete.lower().startswith("bearer "):
            return

        identifiant = _identifiant_du_jeton(entete.split(None, 1)[1].strip())
        if identifiant is None:
            return

        compte = get_user_model().objects.filter(email__iexact=identifiant).first()
        if compte is None:
            journal.warning(
                "Jeton du hub valide pour « %s », mais aucun compte ne porte "
                "cette adresse dans BDM.",
                identifiant,
            )
            return
        if not compte.is_active:
            return

        # `backend` doit etre nomme : BDM n'a qu'un backend maison, et
        # `login()` refuse de choisir a notre place quand l'utilisateur ne
        # vient pas de `authenticate()`.
        login(requete, compte, backend=settings.AUTHENTICATION_BACKENDS[0])
