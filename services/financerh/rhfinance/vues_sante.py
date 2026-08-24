"""Sonde de sante du service financerh, hors API authentifiee."""

from django.db import connection
from django.http import JsonResponse


def sante(requete):
    """Le processus repond et la base est joignable."""
    try:
        with connection.cursor() as curseur:
            curseur.execute("SELECT 1")
        base = "ok"
        code = 200
    except Exception as erreur:  # noqa: BLE001 - le motif est utile dans la reponse
        base = f"indisponible : {erreur}"
        code = 503
    return JsonResponse({"service": "financerh", "base": base}, status=code)
