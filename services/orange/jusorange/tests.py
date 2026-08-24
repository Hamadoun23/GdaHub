"""Tests du domaine Jus d'Orange.

    docker compose exec orange python manage.py test

Ce qui est garde : les calculs sur lesquels reposent la qualite d'un
producteur, la tracabilite d'un lot et le recouvrement des creances. Ce sont
les trois endroits ou une erreur coute reellement quelque chose.
"""

from datetime import date, timedelta

from django.test import TestCase
from rest_framework.exceptions import ValidationError

from jusorange import services
from jusorange.models import (
    ArticleStock,
    Bouteille,
    ClientJus,
    Conditionnement,
    Cueillette,
    Facture,
    Inventaire,
    Paiement,
    PointVente,
    Producteur,
    Production,
    QualiteInventaire,
    Reception,
    ReceptionPaiement,
    Recette,
    StatutBouteille,
    StatutFacture,
    StatutProduction,
    StatutProspect,
    StatutReception,
    TypeArticle,
    TypeProducteur,
    Vente,
    Visite,
)
from jusorange.serializers import ProductionSerializer, ReceptionSerializer


class Recolte(TestCase):
    def setUp(self):
        self.producteur = Producteur.objects.create(
            nom_complet="Moussa Diallo", type_producteur=TypeProducteur.INTERNE
        )

    def test_la_perte_se_deduit(self):
        """Laisser saisir les trois chiffres garantit qu'ils ne tombent plus juste."""
        cueillette = Cueillette.objects.create(
            producteur=self.producteur,
            date_cueillette=date(2026, 9, 1),
            quantite_totale=1000,
            quantite_bonne=850,
        )
        self.assertEqual(cueillette.quantite_mauvaise, 150)

    def test_taux_de_qualite(self):
        cueillette = Cueillette.objects.create(
            producteur=self.producteur,
            date_cueillette=date(2026, 9, 1),
            quantite_totale=1000,
            quantite_bonne=850,
        )
        self.assertEqual(cueillette.taux_qualite, 85.0)

    def test_taux_sur_une_cueillette_vide(self):
        cueillette = Cueillette.objects.create(
            producteur=self.producteur,
            date_cueillette=date(2026, 9, 1),
            quantite_totale=0,
            quantite_bonne=0,
        )
        self.assertEqual(cueillette.taux_qualite, 0)

    def test_le_nom_du_producteur_est_archive(self):
        """Une cueillette est un fait : elle survit au depart du producteur."""
        cueillette = Cueillette.objects.create(
            producteur=self.producteur,
            date_cueillette=date(2026, 9, 1),
            quantite_totale=100,
            quantite_bonne=90,
        )
        self.producteur.delete()
        cueillette.refresh_from_db()
        self.assertIsNone(cueillette.producteur)
        self.assertIn("Moussa Diallo", cueillette.producteur_affiche)
        self.assertIn("retire", cueillette.producteur_affiche)


class Receptions(TestCase):
    def setUp(self):
        self.interne = Producteur.objects.create(
            nom_complet="Verger GDA", type_producteur=TypeProducteur.INTERNE
        )
        self.externe = Producteur.objects.create(
            nom_complet="Fournisseur Segou", type_producteur=TypeProducteur.EXTERNE
        )
        self.cueillette = Cueillette.objects.create(
            producteur=self.interne,
            date_cueillette=date(2026, 9, 1),
            quantite_totale=1000,
            quantite_bonne=900,
        )

    def test_numero_remis_a_zero_chaque_jour(self):
        """Les operateurs le lisent a voix haute au telephone."""
        premiere = Reception.objects.create(
            cueillette=self.cueillette,
            date_reception=date(2026, 9, 1),
            quantite_recue=500,
            quantite_bonne=480,
        )
        seconde = Reception.objects.create(
            cueillette=self.cueillette,
            date_reception=date(2026, 9, 1),
            quantite_recue=200,
            quantite_bonne=190,
        )
        autre_jour = Reception.objects.create(
            cueillette=self.cueillette,
            date_reception=date(2026, 9, 2),
            quantite_recue=100,
            quantite_bonne=100,
        )
        self.assertTrue(premiere.numero.startswith("R001JGDA"))
        self.assertTrue(seconde.numero.startswith("R002JGDA"))
        self.assertTrue(autre_jour.numero.startswith("R001JGDA"))

    def test_le_stock_d_oranges_est_un_cumul(self):
        """Il se recalcule : un compteur incremente finit par diverger."""
        Reception.objects.create(
            cueillette=self.cueillette,
            date_reception=date(2026, 9, 1),
            quantite_recue=500,
            quantite_bonne=480,
        )
        Reception.objects.create(
            cueillette=self.cueillette,
            date_reception=date(2026, 9, 2),
            quantite_recue=300,
            quantite_bonne=290,
        )
        self.assertEqual(services.recalculer_stock_oranges(), 770)
        self.assertEqual(services.stock_de(TypeArticle.ORANGE), 770)

    def test_une_correction_refait_le_stock(self):
        reception = Reception.objects.create(
            cueillette=self.cueillette,
            date_reception=date(2026, 9, 1),
            quantite_recue=500,
            quantite_bonne=480,
        )
        services.recalculer_stock_oranges()
        reception.quantite_bonne = 400
        reception.save()
        self.assertEqual(services.recalculer_stock_oranges(), 400)

    def test_etat_de_qualite(self):
        excellente = Reception(quantite_recue=100, quantite_bonne=85)
        bonne = Reception(quantite_recue=100, quantite_bonne=60)
        mauvaise = Reception(quantite_recue=100, quantite_bonne=30)
        self.assertEqual(excellente.etat_qualite, "EXCELLENT")
        self.assertEqual(bonne.etat_qualite, "BON")
        self.assertEqual(mauvaise.etat_qualite, "MAUVAIS")

    def test_une_origine_et_une_seule(self):
        formulaire = ReceptionSerializer(
            data={
                "cueillette": self.cueillette.pk,
                "producteur_externe": self.externe.pk,
                "date_reception": "2026-09-01",
                "quantite_recue": 100,
                "quantite_bonne": 90,
            }
        )
        with self.assertRaises(ValidationError):
            formulaire.is_valid(raise_exception=True)

    def test_une_origine_est_obligatoire(self):
        formulaire = ReceptionSerializer(
            data={
                "date_reception": "2026-09-01",
                "quantite_recue": 100,
                "quantite_bonne": 90,
            }
        )
        with self.assertRaises(ValidationError):
            formulaire.is_valid(raise_exception=True)

    def test_un_producteur_interne_ne_livre_pas_en_direct(self):
        """Sa recolte passe par une cueillette : c'est ce qui la rend suivie."""
        formulaire = ReceptionSerializer(
            data={
                "producteur_externe": self.interne.pk,
                "date_reception": "2026-09-01",
                "quantite_recue": 100,
                "quantite_bonne": 90,
            }
        )
        with self.assertRaises(ValidationError):
            formulaire.is_valid(raise_exception=True)


class Fabrication(TestCase):
    def test_numero_d_ordre_par_jour(self):
        premiere = Production.objects.create(
            date_production=date(2026, 9, 1), recette=Recette.R80_20
        )
        seconde = Production.objects.create(
            date_production=date(2026, 9, 1), recette=Recette.R80_20
        )
        self.assertTrue(premiere.numero.startswith("OF001"))
        self.assertTrue(seconde.numero.startswith("OF002"))

    def test_les_controles_sanitaires(self):
        production = Production(
            lavage_effectue=True,
            filtration_effectuee=True,
            pasteurisation_80c=True,
        )
        self.assertTrue(production.controles_complets)

    def test_on_ne_termine_pas_sans_controles(self):
        """C'est cette ligne qu'on ressort en cas de reclamation sur un lot."""
        formulaire = ProductionSerializer(
            data={
                "date_production": "2026-09-01",
                "recette": Recette.R80_20,
                "statut": StatutProduction.TERMINEE,
                "lavage_effectue": True,
                "filtration_effectuee": False,
                "pasteurisation_80c": True,
            }
        )
        with self.assertRaises(ValidationError):
            formulaire.is_valid(raise_exception=True)

    def test_une_production_en_cours_n_exige_rien(self):
        formulaire = ProductionSerializer(
            data={"date_production": "2026-09-01", "recette": Recette.R80_20}
        )
        self.assertTrue(formulaire.is_valid(), formulaire.errors)


class Conditionnements(TestCase):
    def setUp(self):
        self.production = Production.objects.create(
            date_production=date(2026, 9, 1), recette=Recette.R80_20
        )
        self.conditionnement = Conditionnement.objects.create(
            date_conditionnement=date(2026, 9, 2),
            quantite_33cl=10,
            quantite_1l=5,
            production=self.production,
        )

    def test_une_ligne_par_bouteille(self):
        """C'est la maille du rappel de lot."""
        creees = services.produire_bouteilles(self.conditionnement)
        self.assertEqual(creees, 15)
        self.assertEqual(self.conditionnement.bouteilles.count(), 15)

    def test_les_formats_sont_respectes(self):
        services.produire_bouteilles(self.conditionnement)
        self.assertEqual(
            self.conditionnement.bouteilles.filter(format_litre=True).count(), 5
        )
        self.assertEqual(
            self.conditionnement.bouteilles.filter(format_litre=False).count(), 10
        )

    def test_la_fonction_se_rejoue_sans_dupliquer(self):
        services.produire_bouteilles(self.conditionnement)
        services.produire_bouteilles(self.conditionnement)
        self.assertEqual(self.conditionnement.bouteilles.count(), 15)

    def test_la_dlc_est_posee(self):
        services.produire_bouteilles(self.conditionnement)
        bouteille = self.conditionnement.bouteilles.first()
        attendue = date(2026, 9, 2) + timedelta(days=services.CONSERVATION_JOURS)
        self.assertEqual(bouteille.date_limite, attendue)

    def test_le_stock_de_jus_suit_les_bouteilles(self):
        services.produire_bouteilles(self.conditionnement)
        self.assertEqual(services.stock_de(TypeArticle.JUS_33), 10)
        self.assertEqual(services.stock_de(TypeArticle.JUS_1L), 5)


class Inventaires(TestCase):
    def setUp(self):
        self.article = ArticleStock.objects.create(
            type_article=TypeArticle.ORANGE, quantite=1000, seuil_alerte=100
        )

    def creer(self, systeme, depot):
        return Inventaire.objects.create(
            article=self.article,
            date_inventaire=date(2026, 9, 1),
            quantite_systeme=systeme,
            quantite_depot=depot,
        )

    def test_l_ecart_se_calcule(self):
        self.assertEqual(self.creer(1000, 950).ecart, -50)

    def test_un_ecart_se_juge_en_proportion(self):
        """Cinq kilos sur une tonne n'ont pas le sens de cinq kilos sur dix."""
        self.assertEqual(self.creer(1000, 970).qualite, QualiteInventaire.BON)
        self.assertEqual(self.creer(1000, 900).qualite, QualiteInventaire.MOYEN)
        self.assertEqual(self.creer(1000, 700).qualite, QualiteInventaire.MAUVAIS)

    def test_sans_stock_theorique_on_juge_en_valeur(self):
        self.assertEqual(self.creer(0, 3).qualite, QualiteInventaire.BON)
        self.assertEqual(self.creer(0, 50).qualite, QualiteInventaire.MAUVAIS)

    def test_alerte_de_stock(self):
        self.article.quantite = 50
        self.article.save()
        self.assertTrue(self.article.sous_alerte)


class Recouvrement(TestCase):
    def setUp(self):
        self.client_jus = ClientJus.objects.create(nom_complet="Supermarche Fleuve")
        self.vente = Vente.objects.create(
            client=self.client_jus, date_vente=date(2026, 9, 1), montant_total=100000
        )
        self.facture = Facture.objects.create(
            vente=self.vente,
            date_facture=date(2026, 9, 1),
            montant=100000,
            date_echeance=date(2026, 10, 1),
        )

    def test_une_facture_neuve_est_emise(self):
        self.assertEqual(self.facture.statut, StatutFacture.EMISE)
        self.assertEqual(self.facture.reste_a_payer, 100000)

    def test_un_paiement_partiel_change_le_statut(self):
        Paiement.objects.create(
            facture=self.facture,
            date_paiement=date(2026, 9, 10),
            montant=40000,
            mode="ESPECE",
        )
        self.facture.refresh_from_db()
        self.assertEqual(self.facture.statut, StatutFacture.PARTIELLE)
        self.assertEqual(self.facture.reste_a_payer, 60000)

    def test_le_solde_clot_la_facture(self):
        """Une facture marquee soldee a tort disparait des relances."""
        Paiement.objects.create(
            facture=self.facture,
            date_paiement=date(2026, 9, 10),
            montant=100000,
            mode="VIREMENT",
        )
        self.facture.refresh_from_db()
        self.assertEqual(self.facture.statut, StatutFacture.SOLDEE)
        self.assertEqual(self.facture.reste_a_payer, 0)

    def test_la_vente_connait_son_reste(self):
        Paiement.objects.create(
            facture=self.facture,
            date_paiement=date(2026, 9, 10),
            montant=30000,
            mode="MOBILE",
        )
        self.assertEqual(self.vente.montant_regle, 30000)
        self.assertEqual(self.vente.reste_a_payer, 70000)


class ControleDeCaisse(TestCase):
    """Le commercial declare, la tresorerie constate."""

    def setUp(self):
        client = ClientJus.objects.create(nom_complet="Boutique Niger")
        vente = Vente.objects.create(
            client=client, date_vente=date(2026, 9, 1), montant_total=50000
        )
        facture = Facture.objects.create(
            vente=vente,
            date_facture=date(2026, 9, 1),
            montant=50000,
            date_echeance=date(2026, 10, 1),
        )
        self.paiement = Paiement.objects.create(
            facture=facture,
            date_paiement=date(2026, 9, 5),
            montant=50000,
            mode="ESPECE",
        )

    def recevoir(self, montant):
        return ReceptionPaiement.objects.create(
            paiement=self.paiement,
            montant_recu=montant,
            date_reception=date(2026, 9, 6),
        )

    def test_conforme(self):
        reception = self.recevoir(50000)
        self.assertEqual(reception.statut, StatutReception.CONFORME)
        self.assertEqual(reception.ecart, 0)

    def test_manquant(self):
        """Sans ce controle, un manquant se noierait dans les comptes."""
        reception = self.recevoir(45000)
        self.assertEqual(reception.statut, StatutReception.ECART_NEGATIF)
        self.assertEqual(reception.ecart, -5000)

    def test_excedent(self):
        reception = self.recevoir(52000)
        self.assertEqual(reception.statut, StatutReception.ECART_POSITIF)
        self.assertEqual(reception.ecart, 2000)


class Prospection(TestCase):
    def setUp(self):
        self.point = PointVente.objects.create(
            nom="Alimentation Badalabougou", zone="Bamako"
        )

    def test_statut_initial(self):
        self.assertEqual(self.point.statut, StatutProspect.PROSPECTE)

    def test_une_visite_met_a_jour_le_statut(self):
        """Sinon le commercial doit le faire deux fois, et il oublie."""
        Visite.objects.create(
            point_vente=self.point,
            date_visite=date(2026, 9, 1),
            statut_apres=StatutProspect.INTERESSE,
            compte_rendu="Interesse par le format 33 cl",
        )
        self.point.refresh_from_db()
        self.assertEqual(self.point.statut, StatutProspect.INTERESSE)

    def test_une_visite_sans_changement_de_statut(self):
        Visite.objects.create(
            point_vente=self.point,
            date_visite=date(2026, 9, 1),
            compte_rendu="Responsable absent",
        )
        self.point.refresh_from_db()
        self.assertEqual(self.point.statut, StatutProspect.PROSPECTE)


class Peremption(TestCase):
    def test_les_bouteilles_perimees_se_retrouvent(self):
        conditionnement = Conditionnement.objects.create(
            date_conditionnement=date(2026, 1, 1), quantite_33cl=2
        )
        services.produire_bouteilles(conditionnement)
        depassees = Bouteille.objects.filter(
            statut=StatutBouteille.DISPONIBLE, date_limite__lt=date(2026, 12, 31)
        )
        self.assertEqual(depassees.count(), 2)
