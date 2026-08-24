"""Regles metier du domaine Organisation.

Les vues n'en portent aucune : elles lisent la requete, appellent d'ici, et
rendent la reponse. C'est ce qui permet de tester l'organigramme sans monter
un client HTTP.
"""

from __future__ import annotations

from organisation.models import Agent


def rapprocher_compte(agent: Agent, compte_id: int) -> Agent:
    """Associe une fiche agent au compte identity de la personne.

    L'appariement se fait a la premiere connexion de l'interesse : son jeton
    porte a la fois son identifiant et l'identifiant numerique de son compte,
    les deux bouts du lien. Aucune authentification de service n'est donc
    necessaire — organisation n'a jamais besoin d'interroger identity.

    Si le compte est deja rattache a une autre fiche, on ne touche a rien :
    deux fiches pour une meme personne est un probleme d'annuaire, il se
    corrige a la main, pas par ecrasement silencieux.
    """
    if agent.compte_id == compte_id:
        return agent
    if Agent.objects.filter(compte_id=compte_id).exclude(pk=agent.pk).exists():
        return agent
    agent.compte_id = compte_id
    agent.save(update_fields=["compte_id", "modifie_le"])
    return agent


def fiche_du_porteur(utilisateur) -> Agent | None:
    """La fiche de la personne qui fait la requete, rapprochee au passage.

    On cherche d'abord par le compte deja rattache, puis par l'identifiant de
    connexion. Le second chemin ne sert qu'une fois par personne : ensuite le
    lien existe.
    """
    agent = Agent.objects.filter(compte_id=utilisateur.id).first()
    if agent is not None:
        return agent

    agent = Agent.objects.filter(identifiant__iexact=utilisateur.identifiant).first()
    if agent is not None:
        return rapprocher_compte(agent, utilisateur.id)
    return None


def chaine_hierarchique(agent: Agent, profondeur_max: int = 10) -> list[Agent]:
    """Les responsables successifs d'un agent, du plus proche au plus haut.

    Le garde-fou de profondeur n'est pas theorique : un organigramme se saisit
    a la main, et une boucle — A rattache a B, B rattache a A — bloquerait la
    validation de toutes leurs demandes.
    """
    chaine: list[Agent] = []
    vus = {agent.pk}
    courant = agent.responsable

    while courant is not None and len(chaine) < profondeur_max:
        if courant.pk in vus:
            break  # boucle dans l'organigramme : on s'arrete la
        chaine.append(courant)
        vus.add(courant.pk)
        courant = courant.responsable

    return chaine


def organigramme(racine: Agent | None = None) -> list[dict]:
    """L'arbre des rattachements, pret a etre affiche.

    Une seule requete ramene tout l'effectif : l'organigramme d'un groupe de
    quelques centaines de personnes tient en memoire, et le construire agent
    par agent multiplierait les allers-retours par le nombre de noeuds.
    """
    agents = list(
        Agent.objects.filter(actif=True).select_related("departement", "responsable")
    )
    enfants: dict[int | None, list[Agent]] = {}
    for agent in agents:
        enfants.setdefault(agent.responsable_id, []).append(agent)

    def noeud(agent: Agent) -> dict:
        return {
            **agent.instantane(),
            "identifiant": agent.identifiant,
            "equipe": [noeud(membre) for membre in enfants.get(agent.pk, [])],
        }

    if racine is not None:
        return [noeud(racine)]
    # Les sommets sont les agents sans responsable : le directeur general, et
    # toute personne dont le rattachement n'a pas encore ete saisi.
    return [noeud(agent) for agent in enfants.get(None, [])]
