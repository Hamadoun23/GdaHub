"""Variables disponibles dans le gabarit racine (templates/app.html)."""

import json

from django.conf import settings
from django.utils.safestring import mark_safe

from .routes import objet_ziggy


def app_context(request):
    return {
        "app_name": settings.APP_NAME,
        # Équivalent de la directive Blade @routes de Ziggy : le helper route()
        # du frontend consomme cet objet tel quel.
        "ziggy_json": mark_safe(json.dumps(objet_ziggy(request))),
    }
