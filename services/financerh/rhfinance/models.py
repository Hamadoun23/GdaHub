"""Modeles du domaine RH & Finance.

Origine du code a reprendre : FinanceRH (Django 6 + DRF + Next 16, Postgres) - en production sur rh.gdamali.net

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

Deux particularites propres a ce service :

- Il porte deux domaines, les ressources humaines et la finance, reunis dans
  l'application d'origine par un meme circuit de validation. On les garde
  ensemble tant que ce circuit reste commun ; le jour ou ils divergent, la
  separation se fera sur cette ligne de faille, pas ailleurs.
- C'est le seul domaine deja en production, sur rh.gdamali.net. La reprise
  part donc de son schema reel : des conges poses et des demandes en cours de
  validation existent, il n'y a pas de page blanche.
"""

from django.db import models  # noqa: F401  (utilise des le premier modele)
