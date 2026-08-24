"""Modeles du domaine Finance.

Origine du code a reprendre : FinanceRH/backend/finance (Django 6 + DRF) - en production

Separe des ressources humaines, alors que l'application d'origine
les reunissait.

Ce qui les tenait ensemble n'etait pas le metier mais le circuit de
validation, partage par les deux. Ce circuit vit desormais dans le socle
(`gdahub_common`), et les regles qui le parametrent appartiennent a Direction.
Une fois cette dependance sortie, plus rien ne justifiait qu'une demande de
conge et un bon d'engagement habitent la meme base.

Deux regles tiennent tout le decoupage :

1. Ce module est le seul a ecrire dans cette base. Aucun autre service n'y
   touche, meme en lecture.
2. Aucune cle etrangere ne sort du module. Une donnee qui appartient a un
   autre domaine est referencee par son identifiant nu, accompagne des
   quelques champs a afficher, figes au moment de l'enregistrement.
"""

from django.db import models  # noqa: F401  (utilise des le premier modele)
