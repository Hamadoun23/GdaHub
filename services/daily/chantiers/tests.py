"""Tests du domaine Chantiers.

    docker compose exec daily python manage.py test

Ce qui est gardé : le calcul d'avancement — c'est lui qu'un client regarde —
et la règle de confidentialité vis-à-vis des partenaires, qui ne se rattrape
pas si elle fuit une fois.
"""

from datetime import date

from django.test import TestCase
from gdahub_common.identite import UtilisateurJeton

from chantiers import services
from chantiers.models import (
    AffectationProjet,
    JournalActivite,
    MiseAJourJournaliere,
    NoteAvancement,
    Phase,
    Projet,
    SousPhase,
    StatutTache,
    Tache,
)
from chantiers.permissions import est_partenaire


def jeton(identifiant, *roles, nom=""):
    return UtilisateurJeton(
        id=abs(hash(identifiant)) % 10000,
        identifiant=identifiant,
        nom_complet=nom or identifiant,
        roles=list(roles),
        habilitations={"daily": list(roles)},
    )


class BaseChantier(TestCase):
    def setUp(self):
        self.projet = Projet.objects.create(nom="Immeuble Hamdallaye")
        AffectationProjet.objects.create(
            projet=self.projet,
            agent_identifiant="chef@gdamali.net",
            agent_nom="Bina Chef",
        )
        self.phase = Phase.objects.create(projet=self.projet, nom="Gros oeuvre")
        self.sous_phase = SousPhase.objects.create(phase=self.phase, nom="Fondations")
        self.tache = Tache.objects.create(
            sous_phase=self.sous_phase, activite="Coulage de la dalle"
        )
        self.chef = jeton("chef@gdamali.net", "chef_chantier", nom="Bina Chef")


class Avancement(BaseChantier):
    def test_zero_sans_saisie(self):
        self.assertEqual(self.tache.avancement(), 0)
        self.assertEqual(self.projet.avancement(), 0)

    def test_projet_sans_tache(self):
        vide = Projet.objects.create(nom="Terrain nu")
        self.assertEqual(vide.avancement(), 0)

    def test_derniere_saisie_fait_foi(self):
        services.enregistrer_avancement(
            self.tache, date(2026, 9, 1), 30, "Debut", self.chef
        )
        services.enregistrer_avancement(
            self.tache, date(2026, 9, 3), 70, "Suite", self.chef
        )
        self.assertEqual(self.tache.avancement(), 70)

    def test_une_tache_non_commencee_tire_la_moyenne_vers_le_bas(self):
        """Sinon un chantier a peine demarre afficherait 100 %.

        C'est le chiffre que regarde un client : l'ignorer serait mentir.
        """
        Tache.objects.create(sous_phase=self.sous_phase, activite="Elevation")
        services.enregistrer_avancement(
            self.tache, date(2026, 9, 1), 100, "Fini", self.chef
        )
        self.assertEqual(self.projet.avancement(), 50)

    def test_avancement_par_phase(self):
        services.enregistrer_avancement(
            self.tache, date(2026, 9, 1), 40, "", self.chef
        )
        self.assertEqual(self.projet.avancement_par_phase(), {"Gros oeuvre": 40})

    def test_statut_deduit_de_l_avancement(self):
        """Laisser les deux independants produisait des taches terminees a 40 %."""
        saisie = services.enregistrer_avancement(
            self.tache, date(2026, 9, 1), 0, "", self.chef
        )
        self.assertEqual(saisie.statut, StatutTache.NON_DEMARRE)

        saisie = services.enregistrer_avancement(
            self.tache, date(2026, 9, 2), 55, "", self.chef
        )
        self.assertEqual(saisie.statut, StatutTache.EN_COURS)

        saisie = services.enregistrer_avancement(
            self.tache, date(2026, 9, 3), 100, "", self.chef
        )
        self.assertEqual(saisie.statut, StatutTache.TERMINE)


class SaisieJournaliere(BaseChantier):
    def test_une_seule_saisie_par_jour(self):
        """Une deuxieme corrige la premiere plutot que de s'ajouter."""
        services.enregistrer_avancement(
            self.tache, date(2026, 9, 1), 30, "Premier chiffre", self.chef
        )
        services.enregistrer_avancement(
            self.tache, date(2026, 9, 1), 45, "Corrige", self.chef
        )
        saisies = MiseAJourJournaliere.objects.filter(
            tache=self.tache, date_rapport=date(2026, 9, 1)
        )
        self.assertEqual(saisies.count(), 1)
        self.assertEqual(saisies.first().avancement, 45)

    def test_une_note_est_creee_quand_l_avancement_bouge(self):
        services.enregistrer_avancement(
            self.tache, date(2026, 9, 1), 30, "Dalle coulee", self.chef
        )
        note = NoteAvancement.objects.get(tache=self.tache)
        self.assertEqual(note.avancement_precedent, 0)
        self.assertEqual(note.avancement, 30)
        self.assertEqual(note.corps, "Dalle coulee")

    def test_pas_de_note_quand_rien_ne_bouge(self):
        """Confirmer la veille sans rien faire avancer n'a pas a etre commente."""
        services.enregistrer_avancement(
            self.tache, date(2026, 9, 1), 30, "Dalle", self.chef
        )
        services.enregistrer_avancement(
            self.tache, date(2026, 9, 2), 30, "Toujours pareil", self.chef
        )
        self.assertEqual(NoteAvancement.objects.filter(tache=self.tache).count(), 1)

    def test_qui_a_saisi_est_consigne(self):
        saisie = services.enregistrer_avancement(
            self.tache, date(2026, 9, 1), 30, "", self.chef
        )
        self.assertEqual(saisie.agent_identifiant, "chef@gdamali.net")
        self.assertEqual(saisie.agent_nom, "Bina Chef")

    def test_le_geste_est_journalise(self):
        """Un chantier se conteste : cela se verifie ici, et nulle part ailleurs."""
        services.enregistrer_avancement(
            self.tache, date(2026, 9, 1), 30, "", self.chef
        )
        trace = JournalActivite.objects.get(objet_id=self.tache.pk)
        self.assertEqual(trace.action, "saisie_avancement")
        self.assertEqual(trace.projet_id, self.projet.pk)
        self.assertIn("0 -> 30", trace.description)

    def test_historique_complet(self):
        services.enregistrer_avancement(
            self.tache, date(2026, 9, 1), 30, "Debut", self.chef
        )
        services.enregistrer_avancement(
            self.tache, date(2026, 9, 2), 60, "Suite", self.chef
        )
        historique = services.historique_de(self.tache)
        self.assertEqual(len(historique["saisies"]), 2)
        self.assertEqual(len(historique["notes"]), 2)
        self.assertEqual(historique["tache"]["avancement"], 60)


class Perimetre(BaseChantier):
    def test_l_equipe_ne_voit_que_ses_chantiers(self):
        autre = Projet.objects.create(nom="Autre chantier")
        AffectationProjet.objects.create(
            projet=autre, agent_identifiant="autre@gdamali.net"
        )
        visibles = services.projets_visibles(Projet.objects.all(), self.chef)
        self.assertEqual([projet.nom for projet in visibles], ["Immeuble Hamdallaye"])

    def test_l_administrateur_voit_tout(self):
        Projet.objects.create(nom="Autre chantier")
        admin = jeton("admin@gdamali.net", "admin")
        self.assertEqual(services.projets_visibles(Projet.objects.all(), admin).count(), 2)

    def test_un_superadmin_voit_tout(self):
        Projet.objects.create(nom="Autre chantier")
        superadmin = UtilisateurJeton(
            id=1, identifiant="hcisse@gdamali.net", est_superadmin=True
        )
        self.assertEqual(
            services.projets_visibles(Projet.objects.all(), superadmin).count(), 2
        )


class Confidentialite(TestCase):
    """Un partenaire voit le chantier, pas ce que GDA garde pour elle."""

    def test_partenaire_pur(self):
        self.assertTrue(est_partenaire(jeton("client@exterieur.net", "partenaire")))

    def test_le_cumul_fait_pencher_vers_l_equipe(self):
        """Un agent GDA qui est aussi partenaire d'un projet reste de l'equipe.

        Le traiter en partenaire lui masquerait des lignes sur lesquelles il
        doit justement travailler.
        """
        self.assertFalse(
            est_partenaire(jeton("chef@gdamali.net", "partenaire", "chef_chantier"))
        )

    def test_un_superadmin_n_est_pas_un_partenaire(self):
        superadmin = UtilisateurJeton(
            id=1,
            identifiant="hcisse@gdamali.net",
            est_superadmin=True,
            roles=["partenaire"],
        )
        self.assertFalse(est_partenaire(superadmin))

    def test_l_equipe_n_est_pas_partenaire(self):
        self.assertFalse(est_partenaire(jeton("ing@gdamali.net", "ingenieur")))


class Rapports(BaseChantier):
    def test_l_avancement_du_rapport_est_fige(self):
        """C'est ce qui en fait une piece datee plutot qu'un affichage vivant."""
        from chantiers.models import RapportJournalier

        services.enregistrer_avancement(
            self.tache, date(2026, 9, 1), 40, "", self.chef
        )
        rapport = RapportJournalier.objects.create(
            projet=self.projet, date_rapport=date(2026, 9, 1), meteo="Pluie"
        )
        services.cloturer_rapport(self.projet, rapport)
        self.assertEqual(rapport.avancement_global, 40)

        # Le chantier avance ; le rapport de la veille ne bouge pas.
        services.enregistrer_avancement(
            self.tache, date(2026, 9, 2), 90, "", self.chef
        )
        rapport.refresh_from_db()
        self.assertEqual(rapport.avancement_global, 40)
