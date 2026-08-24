"""Modeles du domaine Ressources humaines.

Origine du code a reprendre : FinanceRH/backend/rh (Django 6 + DRF) - en production

Ce service ne tient pas l'annuaire : il le consomme.

Un agent appartient a Organisation. Ici on ne stocke que son identifiant et
son nom d'affichage. C'est ce qui permettra un jour de corriger un
rattachement a un seul endroit.

La permission d'absence est un objet distinct du conge, comme dans
l'application en production : elle n'entame pas le solde annuel et se demande
dans son propre ecran.

Deux regles tiennent tout le decoupage :

1. Ce module est le seul a ecrire dans cette base. Aucun autre service n'y
   touche, meme en lecture.
2. Aucune cle etrangere ne sort du module. Une donnee qui appartient a un
   autre domaine est referencee par son identifiant nu, accompagne des
   quelques champs a afficher, figes au moment de l'enregistrement.
"""

from django.db import models  # noqa: F401  (utilise des le premier modele)
