"""Ce que les autres domaines ont le droit de demander a Chantiers.

Aucun service n'importe un modele d'un autre service. Il appelle une fonction
de ce module, qui aujourd'hui lit la base locale et deviendra un appel HTTP
le jour ou le domaine sera extrait — sans que l'appelant change d'une ligne.

Tant que rien n'est expose ici, Chantiers est autonome, et c'est la meilleure
situation possible.
"""
