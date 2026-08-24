"""Tests du domaine Organisation.

    docker compose exec organisation python manage.py test

Ils portent sur ce qui casserait sans bruit : la numerotation des matricules,
le rapprochement d'une fiche et de son compte, et les garde-fous de
l'organigramme. Le reste — serialisation, routage — echoue franchement des le
premier appel et n'a pas besoin d'etre garde ici.
"""

from django.core.management import call_command
from django.test import TestCase

from organisation import api, services
from organisation.models import Agent, Departement, prochain_matricule


class JetonFactice:
    """Ce que l'authentification depose dans `request.user`.

    Les tests n'ont pas besoin d'un vrai jeton signe : le domaine ne lit que
    l'identifiant numerique du compte et l'identifiant de connexion.
    """

    def __init__(self, identifiant_compte, identifiant):
        self.id = identifiant_compte
        self.identifiant = identifiant


class Matricules(TestCase):
    def test_premier_matricule_par_defaut(self):
        agent = Agent.objects.create(identifiant="a@gdamali.net", nom="A")
        self.assertEqual(agent.matricule, "AG0001")

    def test_suite_de_la_numerotation_existante(self):
        Agent.objects.create(identifiant="a@gdamali.net", nom="A", matricule="GDA0007")
        agent = Agent.objects.create(identifiant="b@gdamali.net", nom="B")
        self.assertEqual(agent.matricule, "GDA0008")

    def test_deux_creations_dans_la_meme_seconde(self):
        """Le defaut de l'application d'origine : un matricule horodate.

        Deux agents saisis dans la meme seconde recevaient le meme, et la
        seconde ecriture echouait sur la contrainte d'unicite.
        """
        premier = Agent.objects.create(identifiant="a@gdamali.net", nom="A")
        second = Agent.objects.create(identifiant="b@gdamali.net", nom="B")
        self.assertNotEqual(premier.matricule, second.matricule)

    def test_le_prefixe_majoritaire_l_emporte(self):
        for rang in range(1, 4):
            Agent.objects.create(
                identifiant=f"{rang}@gdamali.net", nom=str(rang), matricule=f"GDA{rang:04d}"
            )
        Agent.objects.create(identifiant="x@gdamali.net", nom="X", matricule="TMP0009")
        self.assertTrue(prochain_matricule().startswith("GDA"))

    def test_matricule_fourni_respecte(self):
        agent = Agent.objects.create(
            identifiant="a@gdamali.net", nom="A", matricule="SPECIAL1"
        )
        self.assertEqual(agent.matricule, "SPECIAL1")


class ImportEffectif(TestCase):
    """L'import lit le jeu anonyme livre avec le depot."""

    def setUp(self):
        call_command("importer_effectif", verbosity=0)

    def test_departements_et_agents_crees(self):
        self.assertEqual(Departement.objects.count(), 7)
        self.assertEqual(Agent.objects.count(), 10)

    def test_identifiant_derive_de_l_adresse(self):
        self.assertTrue(Agent.objects.filter(identifiant="d.general@exemple.net").exists())

    def test_rattachements_resolus(self):
        financier = Agent.objects.get(identifiant="r.financier@exemple.net")
        directeur = Agent.objects.get(identifiant="d.general@exemple.net")
        self.assertEqual(financier.responsable_id, directeur.pk)
        self.assertEqual(financier.departement.code, "FIN")

    def test_responsable_de_departement(self):
        directeur = Agent.objects.get(identifiant="d.general@exemple.net")
        self.assertEqual(Departement.objects.get(code="DG").responsable_id, directeur.pk)

    def test_reimport_sans_doublon(self):
        """Relancer l'import ne doit rien dupliquer ni renumeroter."""
        matricules = dict(Agent.objects.values_list("identifiant", "matricule"))
        call_command("importer_effectif", verbosity=0)
        self.assertEqual(Agent.objects.count(), 10)
        self.assertEqual(
            dict(Agent.objects.values_list("identifiant", "matricule")), matricules
        )


class Organigramme(TestCase):
    def setUp(self):
        self.directeur = Agent.objects.create(identifiant="dg@gdamali.net", nom="DG")
        self.chef = Agent.objects.create(
            identifiant="chef@gdamali.net", nom="Chef", responsable=self.directeur
        )
        self.agent = Agent.objects.create(
            identifiant="agent@gdamali.net", nom="Agent", responsable=self.chef
        )

    def test_chaine_hierarchique(self):
        chaine = services.chaine_hierarchique(self.agent)
        self.assertEqual([a.pk for a in chaine], [self.chef.pk, self.directeur.pk])

    def test_une_boucle_ne_bloque_pas(self):
        """Un organigramme se saisit a la main, une boucle finit par arriver.

        Sans garde-fou, la recherche du valideur tournerait indefiniment et
        toutes les demandes de ces deux agents resteraient bloquees.
        """
        self.directeur.responsable = self.agent
        self.directeur.save(update_fields=["responsable"])
        chaine = services.chaine_hierarchique(self.agent)
        self.assertLessEqual(len(chaine), 3)

    def test_encadrement_deduit_du_rattachement(self):
        self.assertTrue(self.chef.est_encadrant)
        self.assertFalse(self.agent.est_encadrant)

    def test_un_agent_sorti_ne_compte_plus_dans_l_encadrement(self):
        self.agent.actif = False
        self.agent.save(update_fields=["actif"])
        self.assertFalse(self.chef.est_encadrant)

    def test_arbre_depuis_les_sommets(self):
        arbre = services.organigramme()
        self.assertEqual(len(arbre), 1)
        self.assertEqual(arbre[0]["agent_id"], self.directeur.pk)
        self.assertEqual(arbre[0]["equipe"][0]["agent_id"], self.chef.pk)


class RapprochementDesComptes(TestCase):
    """Fiche et compte se rejoignent a la premiere connexion de l'interesse.

    Aucun appel d'un service a l'autre : le jeton porte les deux bouts du
    lien, l'identifiant de connexion et le numero de compte.
    """

    def setUp(self):
        self.agent = Agent.objects.create(identifiant="modi.kone@gdamali.net", nom="Kone")

    def test_premiere_connexion_rattache_la_fiche(self):
        fiche = services.fiche_du_porteur(JetonFactice(7, "modi.kone@gdamali.net"))
        self.agent.refresh_from_db()
        self.assertEqual(fiche.pk, self.agent.pk)
        self.assertEqual(self.agent.compte_id, 7)

    def test_connexions_suivantes_passent_par_le_compte(self):
        services.fiche_du_porteur(JetonFactice(7, "modi.kone@gdamali.net"))
        # Meme si l'identifiant change chez identity, le lien tient.
        fiche = services.fiche_du_porteur(JetonFactice(7, "nouvelle.adresse@gdamali.net"))
        self.assertEqual(fiche.pk, self.agent.pk)

    def test_un_compte_deja_rattache_n_est_pas_vole(self):
        """Deux fiches pour une personne se corrige a la main, pas par ecrasement."""
        services.fiche_du_porteur(JetonFactice(7, "modi.kone@gdamali.net"))
        doublon = Agent.objects.create(identifiant="doublon@gdamali.net", nom="Kone")
        services.rapprocher_compte(doublon, 7)
        doublon.refresh_from_db()
        self.assertIsNone(doublon.compte_id)

    def test_compte_sans_fiche(self):
        self.assertIsNone(services.fiche_du_porteur(JetonFactice(99, "inconnu@gdamali.net")))

    def test_recherche_insensible_a_la_casse(self):
        fiche = services.fiche_du_porteur(JetonFactice(7, "Modi.Kone@GDAMALI.net"))
        self.assertIsNotNone(fiche)


class ContratInterServices(TestCase):
    """Ce que les autres domaines recopient chez eux."""

    def setUp(self):
        self.departement = Departement.objects.create(code="FIN", nom="Finance")
        self.directeur = Agent.objects.create(identifiant="dg@gdamali.net", nom="DG")
        self.agent = Agent.objects.create(
            identifiant="a@gdamali.net",
            prenom="Awa",
            nom="Traore",
            poste="Comptable",
            departement=self.departement,
            responsable=self.directeur,
            compte_id=12,
        )

    def test_champs_de_l_instantane(self):
        """Le contrat est ferme : un champ ajoute ici se recopie partout."""
        self.assertEqual(
            set(self.agent.instantane()),
            {"agent_id", "matricule", "nom_complet", "poste", "departement_nom"},
        )

    def test_instantane_du_compte(self):
        self.assertEqual(api.instantane_du_compte(12)["nom_complet"], "Awa Traore")

    def test_responsable_de(self):
        self.assertEqual(api.responsable_de(self.agent.pk)["agent_id"], self.directeur.pk)

    def test_le_sommet_n_a_pas_de_responsable(self):
        self.assertIsNone(api.responsable_de(self.directeur.pk))

    def test_effectif_du_departement(self):
        self.assertEqual(len(api.effectif_du_departement(self.departement.pk)), 1)

    def test_un_agent_sorti_quitte_l_effectif(self):
        self.agent.actif = False
        self.agent.save(update_fields=["actif"])
        self.assertEqual(api.effectif_du_departement(self.departement.pk), [])
