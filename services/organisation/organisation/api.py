"""Ce que les autres domaines ont le droit de demander a Organisation.

Aucun service n'importe un modele d'un autre service. Il appelle une fonction
de ce module, qui aujourd'hui lit la base locale et deviendra un appel HTTP le
jour ou le domaine sera extrait — sans que l'appelant change d'une ligne.

Organisation etant deja un service a part entiere, ces fonctions ne servent
qu'a l'interieur : c'est l'API HTTP que les autres consomment, et le contrat
est le meme des deux cotes.

    GET /api/organisation/mon-contexte             tout ce qu'un document
                                                   doit recopier a sa creation
    GET /api/organisation/agents/{id}/instantane   les champs a recopier
    GET /api/organisation/agents/{id}/hierarchie   la suite des responsables
    GET /api/organisation/agents?departement=      l'effectif d'une unite

`mon-contexte` est la route la plus importante des quatre : elle evite aux
services metier d'interroger l'annuaire ailleurs qu'a la creation d'un
document. Tout le reste — listes, files de validation, tableaux de bord — se
lit ensuite chez eux, sans un seul appel reseau.

Ce que les autres services doivent en retenir : ils recopient l'instantane,
ils ne stockent pas de cle etrangere. Quand un nom change ici, les documents
deja valides gardent le nom qu'ils portaient au moment de la decision — c'est
voulu : un bon d'engagement signe atteste de ce qui etait vrai ce jour-la.
"""

from __future__ import annotations

from organisation.models import Agent


def instantane(agent_id: int) -> dict | None:
    """Les champs qu'un autre domaine recopie a cote de sa donnee metier."""
    agent = Agent.objects.select_related("departement").filter(pk=agent_id).first()
    return agent.instantane() if agent else None


def instantane_du_compte(compte_id: int) -> dict | None:
    """Le meme, retrouve depuis l'identifiant de compte porte par le jeton.

    C'est la forme dont les autres services ont besoin en pratique : ils
    connaissent l'utilisateur qui fait la requete, pas son numero d'agent.
    """
    agent = (
        Agent.objects.select_related("departement").filter(compte_id=compte_id).first()
    )
    return agent.instantane() if agent else None


def contexte_du_compte(compte_id: int) -> dict | None:
    """L'instantane du demandeur et de son responsable, en une seule lecture.

    C'est ce qu'un service metier recopie au moment ou un document est cree.
    Ensuite il ne demande plus rien : le nom du demandeur, son departement et
    le compte de son responsable sont figes dans son propre enregistrement.
    """
    agent = (
        Agent.objects.select_related(
            "departement__responsable__departement", "responsable__departement"
        )
        .filter(compte_id=compte_id)
        .first()
    )
    return agent.contexte() if agent else None


def responsable_de(agent_id: int) -> dict | None:
    """Le premier valideur des demandes d'un agent.

    Toute la mecanique de validation de l'ERP repose sur cette fonction : sans
    responsable rattache, une demande n'a personne a qui remonter, et c'est le
    service `direction` qui decide alors du repli.
    """
    agent = (
        Agent.objects.select_related("responsable__departement")
        .filter(pk=agent_id)
        .first()
    )
    if agent is None or agent.responsable is None:
        return None
    return agent.responsable.instantane()


def effectif_du_departement(departement_id: int) -> list[dict]:
    agents = Agent.objects.select_related("departement").filter(
        departement_id=departement_id, actif=True
    )
    return [agent.instantane() for agent in agents]
