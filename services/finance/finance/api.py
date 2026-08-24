"""Ce que les autres domaines ont le droit de demander a Finance.

Aucun service n'importe un modele d'un autre service. Il appelle une fonction
de ce module, qui aujourd'hui lit la base locale et deviendra un appel HTTP le
jour ou le domaine sera extrait — sans que l'appelant change d'une ligne.
"""
