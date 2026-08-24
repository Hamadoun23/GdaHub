"""Modeles du domaine Organisation.

Origine du code a reprendre : FinanceRH/backend/accounts (Django 6 + DRF) - en production

Ce service est le proprietaire unique de la notion d'employe.

C'est l'arbitrage le plus lourd de tout l'ERP, et il est rendu ici : quatre
applications d'origine tenaient chacune sa liste d'agents, avec des champs et
des cycles de vie differents. Une seule doit rester. Organisation tient
l'annuaire, le rattachement hierarchique et les departements ; les autres
services stockent un `agent_id` nu et le nom qu'ils affichent, fige au moment
de l'enregistrement.

Le rattachement hierarchique n'est pas un libelle d'annuaire : c'est lui qui
designe le premier valideur de chaque demande, dans tous les domaines.

Deux regles tiennent tout le decoupage :

1. Ce module est le seul a ecrire dans cette base. Aucun autre service n'y
   touche, meme en lecture.
2. Aucune cle etrangere ne sort du module. Une donnee qui appartient a un
   autre domaine est referencee par son identifiant nu, accompagne des
   quelques champs a afficher, figes au moment de l'enregistrement.
"""

from django.db import models  # noqa: F401  (utilise des le premier modele)
