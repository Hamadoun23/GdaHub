"""Modeles du domaine Campagnes.

Origine du code a reprendre : DocsERP/BDM (Django + Inertia, MySQL)

Deux regles tiennent tout le decoupage :

1. Ce module est le seul a ecrire dans cette base. Aucun autre service n'y
   touche, meme en lecture.
2. Aucune cle etrangere ne sort du module. Une donnee qui appartient a un
   autre domaine est referencee par son identifiant nu — par exemple
   `utilisateur_id`, l'identite vivant dans identity — accompagne des quelques
   champs a afficher, figes au moment de l'enregistrement.

La seconde regle surprend au debut : elle interdit `select_related` vers les
autres domaines et oblige a recopier un nom. C'est le prix a payer pour que
l'extraction d'un service ne se transforme pas en reecriture du schema.
"""

from django.db import models  # noqa: F401  (utilise des le premier modele)
