"""Modeles du domaine Direction.

Origine du code a reprendre : FinanceRH/backend/core (circuits, seuils) - en production

Ce service possede peu de donnees, et c'est voulu.

Il tient les regles de circuit — qui valide quoi, a partir de quel montant,
dans quel ordre — et le registre consolide des decisions. Le reste de ce qu'il
affiche appartient aux autres services et se lit chez eux.

Reserve a garder en tete : un service qui ne possede presque rien est un
candidat naturel a la fusion. Si les regles de circuit se revelent stables au
point de ne jamais changer sans redeploiement, Direction n'a pas besoin
d'exister separement — ses regles rejoindraient le socle et son tableau de
bord serait un simple ecran du shell. On tranchera apres la reprise, avec des
donnees reelles.

Deux regles tiennent tout le decoupage :

1. Ce module est le seul a ecrire dans cette base. Aucun autre service n'y
   touche, meme en lecture.
2. Aucune cle etrangere ne sort du module. Une donnee qui appartient a un
   autre domaine est referencee par son identifiant nu, accompagne des
   quelques champs a afficher, figes au moment de l'enregistrement.
"""

from django.db import models  # noqa: F401  (utilise des le premier modele)
