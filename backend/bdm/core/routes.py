"""
Génération de la table de routes consommée par le helper `route()` du frontend.

Le code React repris de Laravel appelle `route('admin.campagnes.show', id)` à
199 endroits. Plutôt que de toucher à ces appels, on reconstruit côté Django
l'objet `window.Ziggy` que la bibliothèque `ziggy-js` attend déjà :

    { url, port, defaults, routes: { 'admin.campagnes.show': {
        uri: 'admin/campagnes/{campagne}', methods: ['GET'] } } }

Les URLs Django doivent donc porter exactement les mêmes noms que les routes
Laravel — c'est la seule contrainte, et elle est vérifiée par
`core.tests.test_routes`.
"""

import re
from functools import lru_cache

from django.urls import get_resolver
from django.urls.resolvers import URLPattern, URLResolver

#: `<int:campagne>`, `<slug:x>` ou `<campagne>` → `{campagne}`
_CONVERTISSEUR = re.compile(r"<(?:[^:>]+:)?([^>]+)>")

#: Groupes nommés d'une re_path : `(?P<campagne>[0-9]+)` → `{campagne}`
_GROUPE_NOMME = re.compile(r"\(\?P<([^>]+)>[^)]*\)")


def _uri_ziggy(motif: str) -> str:
    """Traduit un motif d'URL Django en URI de style Laravel."""
    uri = _GROUPE_NOMME.sub(r"{\1}", motif)
    uri = _CONVERTISSEUR.sub(r"{\1}", uri)
    uri = uri.replace("^", "").replace("$", "").replace("\\", "")
    return uri.strip("/")


def _parcourir(patterns, prefixe=""):
    for p in patterns:
        if isinstance(p, URLResolver):
            yield from _parcourir(p.url_patterns, prefixe + str(p.pattern))
        elif isinstance(p, URLPattern) and p.name:
            methodes = getattr(p.callback, "http_methods_autorisees", None)
            yield p.name, {
                "uri": _uri_ziggy(prefixe + str(p.pattern)),
                "methods": list(methodes) if methodes else ["GET", "HEAD"],
            }


@lru_cache(maxsize=1)
def table_de_routes():
    """Toutes les routes nommées du projet, indexées par nom. Calculée une fois."""
    routes = {}
    for nom, definition in _parcourir(get_resolver().url_patterns):
        # En cas d'homonymie, Django résout vers la dernière déclarée.
        routes[nom] = definition
    return routes


def objet_ziggy(request):
    """
    Objet injecté dans le gabarit sous `window.Ziggy`.

    Le port est déduit de l'en-tête `Host`, et non de `request.get_port()` :
    derrière un proxy, ce dernier renvoie le port d'écoute interne de gunicorn
    (8000). Ziggy construirait alors des URL absolues du type
    `https://domaine:8000/...`, injoignables depuis le navigateur.
    """
    hote = request.get_host()
    port = hote.split(":", 1)[1] if ":" in hote else None

    return {
        "url": f"{request.scheme}://{hote}",
        "port": port,
        "defaults": {},
        "routes": table_de_routes(),
    }
