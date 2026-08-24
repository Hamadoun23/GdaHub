"""Tests du domaine Planning.

    docker compose exec planning python manage.py test

Ce qui est garde : le retard — le seul chiffre qu'un client regarde — le
cloisonnement entre clients, souvent concurrents, et les regles qui evitent
de compter deux fois le meme travail dans un bilan mensuel.
"""

from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from gdahub_common.identite import UtilisateurJeton
from rest_framework.exceptions import ValidationError

from planning import services
from planning.models import (
    Client,
    IdeeContenu,
    Publication,
    ReglePublication,
    StatutEcheance,
    Tournage,
    TypeContenu,
)
from planning.serializers import PublicationSerializer


def jeton(identifiant, *roles):
    return UtilisateurJeton(
        id=abs(hash(identifiant)) % 10000,
        identifiant=identifiant,
        nom_complet=identifiant,
        roles=list(roles),
        habilitations={"planning": list(roles)},
    )


class Base(TestCase):
    def setUp(self):
        self.client_gda = Client.objects.create(
            nom_entreprise="Boulangerie du Fleuve",
            compte_identifiant="contact@boulangerie.net",
        )
        self.concurrent = Client.objects.create(
            nom_entreprise="Patisserie Niger",
            compte_identifiant="contact@patisserie.net",
        )
        self.idee = IdeeContenu.objects.create(
            titre="Coulisses de la production", type_contenu=TypeContenu.VIDEO
        )
        self.equipe = jeton("charge@gdamali.net", "team")
        self.client_connecte = jeton("contact@boulangerie.net", "client")
        self.hier = timezone.localdate() - timedelta(days=1)
        self.demain = timezone.localdate() + timedelta(days=1)


class Retard(Base):
    def test_une_echeance_passee_et_en_attente_est_en_retard(self):
        tournage = Tournage.objects.create(client=self.client_gda, date=self.hier)
        self.assertTrue(tournage.en_retard)

    def test_une_echeance_realisee_n_est_jamais_en_retard(self):
        tournage = Tournage.objects.create(
            client=self.client_gda, date=self.hier, statut=StatutEcheance.REALISE
        )
        self.assertFalse(tournage.en_retard)

    def test_une_echeance_a_venir_n_est_pas_en_retard(self):
        tournage = Tournage.objects.create(client=self.client_gda, date=self.demain)
        self.assertFalse(tournage.en_retard)

    def test_imminence_a_trois_jours(self):
        proche = Tournage.objects.create(
            client=self.client_gda, date=timezone.localdate() + timedelta(days=2)
        )
        lointain = Tournage.objects.create(
            client=self.client_gda, date=timezone.localdate() + timedelta(days=10)
        )
        self.assertTrue(proche.imminente)
        self.assertFalse(lointain.imminente)

    def test_les_statuts_qui_appellent_une_reaction(self):
        tournage = Tournage.objects.create(
            client=self.client_gda,
            date=self.hier,
            statut=StatutEcheance.NON_REALISE,
            motif_statut="Materiel indisponible",
        )
        self.assertTrue(tournage.demande_une_action)


class JourDeconseille(Base):
    def test_avertit_sans_interdire(self):
        """Le charge de clientele connait le contexte : on previent, on ne bloque pas."""
        ReglePublication.objects.create(client=self.client_gda, jour="dimanche")
        # 2026-08-30 est un dimanche.
        publication = Publication.objects.create(
            client=self.client_gda, date=timezone.datetime(2026, 8, 30).date()
        )
        self.assertTrue(publication.jour_deconseille)
        self.assertIn("dimanche", publication.avertissement.lower())

    def test_pas_d_avertissement_sans_regle(self):
        publication = Publication.objects.create(
            client=self.client_gda, date=timezone.datetime(2026, 8, 30).date()
        )
        self.assertFalse(publication.jour_deconseille)
        self.assertEqual(publication.avertissement, "")

    def test_la_regle_d_un_client_ne_vaut_pas_pour_l_autre(self):
        ReglePublication.objects.create(client=self.client_gda, jour="dimanche")
        publication = Publication.objects.create(
            client=self.concurrent, date=timezone.datetime(2026, 8, 30).date()
        )
        self.assertFalse(publication.jour_deconseille)


class LiaisonTournagePublication(Base):
    def test_un_tournage_publiable(self):
        tournage = Tournage.objects.create(client=self.client_gda, date=self.hier)
        self.assertTrue(tournage.peut_etre_publie())

    def test_un_tournage_annule_ne_se_publie_pas(self):
        tournage = Tournage.objects.create(
            client=self.client_gda,
            date=self.hier,
            statut=StatutEcheance.ANNULE,
            motif_statut="Client absent",
        )
        self.assertFalse(tournage.peut_etre_publie())

    def test_un_tournage_deja_publie_ne_l_est_pas_deux_fois(self):
        """Sinon le meme travail compterait deux fois dans le bilan du mois."""
        tournage = Tournage.objects.create(client=self.client_gda, date=self.hier)
        Publication.objects.create(
            client=self.client_gda, date=self.demain, tournage=tournage
        )
        self.assertFalse(tournage.peut_etre_publie())

        formulaire = PublicationSerializer(
            data={
                "client": self.client_gda.pk,
                "date": self.demain.isoformat(),
                "tournage": tournage.pk,
            }
        )
        with self.assertRaises(ValidationError):
            formulaire.is_valid(raise_exception=True)

    def test_un_tournage_d_un_autre_client_est_refuse(self):
        tournage = Tournage.objects.create(client=self.concurrent, date=self.hier)
        formulaire = PublicationSerializer(
            data={
                "client": self.client_gda.pk,
                "date": self.demain.isoformat(),
                "tournage": tournage.pk,
            }
        )
        with self.assertRaises(ValidationError):
            formulaire.is_valid(raise_exception=True)


class MotifObligatoire(Base):
    def test_un_statut_non_tenu_doit_s_expliquer(self):
        """Sinon le planning se remplit de « non realise » sans raison connue."""
        formulaire = PublicationSerializer(
            data={
                "client": self.client_gda.pk,
                "date": self.hier.isoformat(),
                "statut": StatutEcheance.NON_REALISE,
            }
        )
        with self.assertRaises(ValidationError):
            formulaire.is_valid(raise_exception=True)

    def test_avec_motif_c_est_accepte(self):
        formulaire = PublicationSerializer(
            data={
                "client": self.client_gda.pk,
                "date": self.hier.isoformat(),
                "statut": StatutEcheance.NON_REALISE,
                "motif_statut": "Visuel non valide par le client",
            }
        )
        self.assertTrue(formulaire.is_valid(), formulaire.errors)

    def test_un_statut_en_attente_n_a_rien_a_expliquer(self):
        formulaire = PublicationSerializer(
            data={"client": self.client_gda.pk, "date": self.demain.isoformat()}
        )
        self.assertTrue(formulaire.is_valid(), formulaire.errors)


class Cloisonnement(Base):
    """Deux clients de GDA sont souvent concurrents."""

    def test_un_client_ne_voit_que_le_sien(self):
        visibles = services.clients_visibles(Client.objects.all(), self.client_connecte)
        self.assertEqual(
            [client.nom_entreprise for client in visibles], ["Boulangerie du Fleuve"]
        )

    def test_l_equipe_voit_tout(self):
        self.assertEqual(
            services.clients_visibles(Client.objects.all(), self.equipe).count(), 2
        )

    def test_le_cloisonnement_vaut_aussi_pour_les_publications(self):
        Publication.objects.create(client=self.client_gda, date=self.demain)
        Publication.objects.create(client=self.concurrent, date=self.demain)
        visibles = services.filtrer_pour(
            Publication.objects.all(), self.client_connecte
        )
        self.assertEqual(visibles.count(), 1)
        self.assertEqual(visibles.first().client_id, self.client_gda.pk)


class Statistiques(Base):
    def test_bilan_du_mois(self):
        mois, annee = self.demain.month, self.demain.year
        debut, _ = services.bornes_du_mois(mois, annee)
        Tournage.objects.create(client=self.client_gda, date=debut)
        Tournage.objects.create(
            client=self.client_gda, date=debut, statut=StatutEcheance.REALISE
        )
        Publication.objects.create(client=self.client_gda, date=debut)

        bilan = services.statistiques(self.client_gda, mois, annee)
        self.assertEqual(bilan["tournages"]["total"], 2)
        self.assertEqual(bilan["tournages"]["realises"], 1)
        self.assertEqual(bilan["publications"]["total"], 1)

    def test_le_bilan_ignore_les_autres_clients(self):
        mois, annee = self.demain.month, self.demain.year
        debut, _ = services.bornes_du_mois(mois, annee)
        Tournage.objects.create(client=self.concurrent, date=debut)
        bilan = services.statistiques(self.client_gda, mois, annee)
        self.assertEqual(bilan["tournages"]["total"], 0)

    def test_nom_du_mois(self):
        self.assertEqual(services.nom_du_mois(9), "Septembre")
        self.assertEqual(services.nom_du_mois(13), "Mois 13")


class Calendrier(Base):
    def test_le_mois_se_lit_en_un_appel(self):
        debut, _ = services.bornes_du_mois(self.demain.month, self.demain.year)
        Tournage.objects.create(client=self.client_gda, date=debut)
        Publication.objects.create(client=self.client_gda, date=debut)

        grille = services.calendrier(self.demain.month, self.demain.year, self.equipe)
        jour = grille["jours"][debut.isoformat()]
        self.assertEqual(len(jour["tournages"]), 1)
        self.assertEqual(len(jour["publications"]), 1)

    def test_le_calendrier_respecte_le_cloisonnement(self):
        debut, _ = services.bornes_du_mois(self.demain.month, self.demain.year)
        Tournage.objects.create(client=self.concurrent, date=debut)
        grille = services.calendrier(
            self.demain.month, self.demain.year, self.client_connecte
        )
        self.assertEqual(grille["jours"], {})


class Rapports(Base):
    def test_le_bilan_est_fige_a_la_generation(self):
        """Un rapport remis ne change pas parce qu'une publication a bouge."""
        mois, annee = self.demain.month, self.demain.year
        debut, _ = services.bornes_du_mois(mois, annee)
        Publication.objects.create(client=self.client_gda, date=debut)

        rapport = services.construire_rapport(self.client_gda, mois, annee, self.equipe)
        self.assertEqual(rapport.indicateurs["publications"]["total"], 1)

        Publication.objects.create(client=self.client_gda, date=debut)
        rapport.refresh_from_db()
        self.assertEqual(rapport.indicateurs["publications"]["total"], 1)

    def test_un_seul_rapport_par_client_et_par_mois(self):
        mois, annee = self.demain.month, self.demain.year
        services.construire_rapport(self.client_gda, mois, annee, self.equipe)
        services.construire_rapport(self.client_gda, mois, annee, self.equipe)
        self.assertEqual(self.client_gda.rapports.count(), 1)

    def test_compteur_de_telechargements(self):
        rapport = services.construire_rapport(
            self.client_gda, self.demain.month, self.demain.year, self.equipe
        )
        rapport.compter_telechargement()
        rapport.compter_telechargement()
        rapport.refresh_from_db()
        self.assertEqual(rapport.telechargements, 2)
