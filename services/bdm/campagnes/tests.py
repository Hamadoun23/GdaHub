"""Tests du domaine Campagnes.

    docker compose exec bdm python manage.py test

Ce qui est garde : le perimetre d'une campagne — c'est lui qui decide qui peut
saisir quoi — et le calcul des primes, qui se traduit en argent verse.
"""

from datetime import date, timedelta

from django.test import TestCase
from django.utils import timezone
from gdahub_common.identite import UtilisateurJeton
from rest_framework.exceptions import ValidationError

from campagnes import services
from campagnes.models import (
    Agence,
    Campagne,
    Client,
    Commercial,
    Organisation,
    Partenaire,
    Prime,
    RapportTelephonique,
    Reclamation,
    StatutCampagne,
    StatutReclamation,
    TypeCarte,
    Vente,
    dans_le_delai,
)
from campagnes.serializers import CampagneSerializer, CommercialSerializer


def jeton(identifiant, *roles):
    return UtilisateurJeton(
        id=abs(hash(identifiant)) % 10000,
        identifiant=identifiant,
        nom_complet=identifiant,
        roles=list(roles),
        habilitations={"bdm": list(roles)},
    )


class Base(TestCase):
    def setUp(self):
        self.bdm = Partenaire.objects.create(
            code="BDM", nom="BDM", organisation=Organisation.AGENCES
        )
        self.uba = Partenaire.objects.create(
            code="UBA", nom="UBA Mali", organisation=Organisation.DIRECTE,
            fiche_adhesion=True,
        )
        self.agence_a = Agence.objects.create(partenaire=self.bdm, nom="Agence Centre")
        self.agence_b = Agence.objects.create(partenaire=self.bdm, nom="Agence Nord")

        self.carte_bdm = TypeCarte.objects.create(
            partenaire=self.bdm, code="BDM_CLASSIC", libelle="Carte classique"
        )
        self.carte_uba = TypeCarte.objects.create(
            partenaire=self.uba, code="GDA_VISA", libelle="VISA prepayee"
        )

        self.awa = Commercial.objects.create(
            identifiant="awa@gdamali.net",
            nom_complet="Awa Traore",
            partenaire=self.bdm,
            agence=self.agence_a,
        )
        self.bina = Commercial.objects.create(
            identifiant="bina@gdamali.net",
            nom_complet="Bina Kone",
            partenaire=self.bdm,
            agence=self.agence_b,
        )
        self.direct = Commercial.objects.create(
            identifiant="direct@gdamali.net",
            nom_complet="Sekou Direct",
            partenaire=self.uba,
        )


class StatutDeCampagne(Base):
    def creer(self, debut, fin, statut=StatutCampagne.PROGRAMMEE):
        return Campagne.objects.create(
            partenaire=self.bdm,
            nom="Campagne test",
            date_debut=debut,
            date_fin=fin,
            statut=statut,
        )

    def test_a_venir(self):
        aujourdhui = date.today()
        campagne = self.creer(aujourdhui + timedelta(days=5), aujourdhui + timedelta(days=30))
        self.assertEqual(campagne.statut_effectif, StatutCampagne.PROGRAMMEE)
        self.assertFalse(campagne.ouverte)

    def test_en_cours(self):
        aujourdhui = date.today()
        campagne = self.creer(aujourdhui - timedelta(days=5), aujourdhui + timedelta(days=5))
        self.assertEqual(campagne.statut_effectif, StatutCampagne.EN_COURS)
        self.assertTrue(campagne.ouverte)

    def test_terminee_par_les_dates(self):
        aujourdhui = date.today()
        campagne = self.creer(aujourdhui - timedelta(days=30), aujourdhui - timedelta(days=1))
        self.assertEqual(campagne.statut_effectif, StatutCampagne.TERMINEE)

    def test_un_statut_manuel_prime_sur_les_dates(self):
        """Une campagne arretee le reste, meme si ses dates disent le contraire.

        C'est une decision, pas un calendrier.
        """
        aujourdhui = date.today()
        campagne = self.creer(
            aujourdhui - timedelta(days=5),
            aujourdhui + timedelta(days=5),
            StatutCampagne.ARRETEE,
        )
        self.assertEqual(campagne.statut_effectif, StatutCampagne.ARRETEE)
        self.assertFalse(campagne.ouverte)


class PerimetreSansAgences(Base):
    """UBA n'a pas de reseau d'agences : tout le decoupage devient sans objet."""

    def setUp(self):
        super().setUp()
        aujourdhui = date.today()
        self.campagne_uba = Campagne.objects.create(
            partenaire=self.uba,
            nom="UBA VISA",
            date_debut=aujourdhui - timedelta(days=1),
            date_fin=aujourdhui + timedelta(days=30),
            toutes_agences=True,
        )
        self.campagne_bdm = Campagne.objects.create(
            partenaire=self.bdm,
            nom="BDM Aout",
            date_debut=aujourdhui - timedelta(days=1),
            date_fin=aujourdhui + timedelta(days=30),
            toutes_agences=True,
        )

    def test_une_campagne_uba_ne_remonte_aucune_agence(self):
        """Sans le bornage, elle remonterait les agences de la BDM."""
        self.assertTrue(self.campagne_uba.sans_agences)
        self.assertEqual(self.campagne_uba.agences_du_perimetre().count(), 0)

    def test_une_campagne_bdm_remonte_les_siennes(self):
        self.assertFalse(self.campagne_bdm.sans_agences)
        self.assertEqual(self.campagne_bdm.agences_du_perimetre().count(), 2)

    def test_les_commerciaux_sont_bornes_au_partenaire(self):
        """Un commercial BDM n'a rien a faire dans une campagne UBA."""
        commerciaux = self.campagne_uba.commerciaux_du_perimetre()
        self.assertEqual([c.identifiant for c in commerciaux], ["direct@gdamali.net"])

    def test_toute_agence_est_concernee_sans_reseau(self):
        self.assertTrue(self.campagne_uba.concerne_agence(self.agence_a.pk))


class PerimetreRestreint(Base):
    def setUp(self):
        super().setUp()
        aujourdhui = date.today()
        self.campagne = Campagne.objects.create(
            partenaire=self.bdm,
            nom="Campagne Centre",
            date_debut=aujourdhui - timedelta(days=1),
            date_fin=aujourdhui + timedelta(days=30),
            toutes_agences=False,
        )
        self.campagne.agences.add(self.agence_a)

    def test_seules_les_agences_retenues(self):
        self.assertEqual(
            [a.nom for a in self.campagne.agences_du_perimetre()], ["Agence Centre"]
        )

    def test_seuls_leurs_commerciaux(self):
        self.assertEqual(
            [c.identifiant for c in self.campagne.commerciaux_du_perimetre()],
            ["awa@gdamali.net"],
        )

    def test_l_engagement_se_verifie(self):
        self.assertTrue(self.campagne.engage(self.awa))
        self.assertFalse(self.campagne.engage(self.bina))

    def test_signataires_designes(self):
        self.campagne.contrat_tous_commerciaux = False
        self.campagne.save()
        self.campagne.signataires.add(self.bina)
        self.assertEqual(
            [c.identifiant for c in self.campagne.commerciaux_du_perimetre()],
            ["bina@gdamali.net"],
        )

    def test_campagnes_ouvertes_pour_un_commercial(self):
        ouvertes = services.campagnes_ouvertes(jeton("awa@gdamali.net"))
        self.assertEqual([c.nom for c in ouvertes], ["Campagne Centre"])

    def test_un_commercial_hors_perimetre_ne_voit_rien(self):
        self.assertEqual(services.campagnes_ouvertes(jeton("bina@gdamali.net")), [])

    def test_l_administration_voit_toutes_les_campagnes_ouvertes(self):
        ouvertes = services.campagnes_ouvertes(jeton("admin@gdamali.net", "admin"))
        self.assertEqual(len(ouvertes), 1)


class SaisieTerrain(Base):
    def setUp(self):
        super().setUp()
        aujourdhui = date.today()
        self.campagne = Campagne.objects.create(
            partenaire=self.bdm,
            nom="BDM Aout",
            date_debut=aujourdhui - timedelta(days=1),
            date_fin=aujourdhui + timedelta(days=30),
        )
        self.client_carte = Client.objects.create(
            commercial=self.awa,
            agence=self.agence_a,
            type_carte=self.carte_bdm,
            prenom="Fatoumata",
            nom="Diarra",
        )

    def test_nom_complet(self):
        self.assertEqual(self.client_carte.nom_complet, "Fatoumata Diarra")

    def test_une_saisie_recente_est_corrigible(self):
        self.assertTrue(self.client_carte.corrigible)

    def test_une_saisie_ancienne_ne_l_est_plus(self):
        """Sinon une vente disparait le jour ou l'on calcule les primes."""
        ancienne = timezone.now() - timedelta(hours=72)
        Client.objects.filter(pk=self.client_carte.pk).update(cree_le=ancienne)
        self.client_carte.refresh_from_db()
        self.assertFalse(self.client_carte.corrigible)

    def test_le_delai_se_lit_seul(self):
        self.assertFalse(dans_le_delai(None))
        self.assertTrue(dans_le_delai(timezone.now()))
        self.assertFalse(dans_le_delai(timezone.now() - timedelta(hours=72)))

    def test_un_commercial_ne_voit_que_ses_ventes(self):
        Vente.objects.create(
            campagne=self.campagne,
            client=self.client_carte,
            type_carte=self.carte_bdm,
            commercial=self.awa,
            agence=self.agence_a,
        )
        autre_client = Client.objects.create(
            commercial=self.bina,
            agence=self.agence_b,
            type_carte=self.carte_bdm,
            prenom="Ousmane",
            nom="Toure",
        )
        Vente.objects.create(
            campagne=self.campagne,
            client=autre_client,
            type_carte=self.carte_bdm,
            commercial=self.bina,
            agence=self.agence_b,
        )
        visibles = services.perimetre_des_ventes(
            Vente.objects.all(), jeton("awa@gdamali.net")
        )
        self.assertEqual(visibles.count(), 1)

    def test_un_chef_d_agence_voit_son_agence(self):
        """C'est ce qui lui permet de repondre a sa direction sans passer par GDA."""
        self.agence_a.chef_identifiant = "awa@gdamali.net"
        self.agence_a.save()
        Vente.objects.create(
            campagne=self.campagne,
            client=self.client_carte,
            type_carte=self.carte_bdm,
            commercial=self.awa,
            agence=self.agence_a,
        )
        collegue = Commercial.objects.create(
            identifiant="collegue@gdamali.net",
            nom_complet="Collegue",
            partenaire=self.bdm,
            agence=self.agence_a,
        )
        Vente.objects.create(
            campagne=self.campagne,
            client=self.client_carte,
            type_carte=self.carte_bdm,
            commercial=collegue,
            agence=self.agence_a,
        )
        visibles = services.perimetre_des_ventes(
            Vente.objects.all(), jeton("awa@gdamali.net")
        )
        self.assertEqual(visibles.count(), 2)

    def test_un_compte_sans_fiche_commerciale_ne_voit_rien(self):
        visibles = services.perimetre_des_ventes(
            Vente.objects.all(), jeton("inconnu@gdamali.net")
        )
        self.assertEqual(visibles.count(), 0)


class Primes(Base):
    def setUp(self):
        super().setUp()
        aujourdhui = date.today()
        self.campagne = Campagne.objects.create(
            partenaire=self.bdm,
            nom="BDM Aout",
            date_debut=aujourdhui - timedelta(days=1),
            date_fin=aujourdhui + timedelta(days=30),
            prime_meilleur_vendeur=25000,
        )
        self.client_carte = Client.objects.create(
            commercial=self.awa,
            agence=self.agence_a,
            type_carte=self.carte_bdm,
            prenom="Fatoumata",
            nom="Diarra",
        )

    def vendre(self, commercial, nombre):
        for _ in range(nombre):
            Vente.objects.create(
                campagne=self.campagne,
                client=self.client_carte,
                type_carte=self.carte_bdm,
                commercial=commercial,
                agence=commercial.agence,
            )

    def test_le_classement_inclut_les_absents(self):
        """Un classement qui masque ceux qui n'ont rien vendu ne dit rien."""
        self.vendre(self.awa, 3)
        lignes = services.classement(self.campagne)
        self.assertEqual(len(lignes), 2)
        self.assertEqual(lignes[0]["identifiant"], "awa@gdamali.net")
        self.assertEqual(lignes[0]["ventes"], 3)
        self.assertEqual(lignes[1]["ventes"], 0)

    def test_la_prime_va_au_premier(self):
        self.vendre(self.awa, 5)
        self.vendre(self.bina, 2)
        periode = date.today().strftime("%Y-%m")
        services.calculer_primes(self.campagne, periode)

        gagnante = Prime.objects.get(commercial=self.awa, periode=periode)
        perdante = Prime.objects.get(commercial=self.bina, periode=periode)
        self.assertEqual(int(gagnante.montant), 25000)
        self.assertEqual(gagnante.rang, 1)
        self.assertEqual(int(perdante.montant), 0)

    def test_pas_de_prime_sans_vente(self):
        """Une prime a quelqu'un qui n'a rien vendu se remarque au versement."""
        periode = date.today().strftime("%Y-%m")
        services.calculer_primes(self.campagne, periode)
        self.assertEqual(
            Prime.objects.filter(periode=periode, montant__gt=0).count(), 0
        )

    def test_le_calcul_est_rejouable(self):
        self.vendre(self.awa, 3)
        periode = date.today().strftime("%Y-%m")
        services.calculer_primes(self.campagne, periode)
        self.vendre(self.bina, 5)
        services.calculer_primes(self.campagne, periode)

        self.assertEqual(Prime.objects.filter(periode=periode).count(), 2)
        self.assertEqual(
            int(Prime.objects.get(commercial=self.bina, periode=periode).montant), 25000
        )
        self.assertEqual(
            int(Prime.objects.get(commercial=self.awa, periode=periode).montant), 0
        )

    def test_une_prime_versee_ne_se_recalcule_pas(self):
        """Un versement constate ne se rejoue pas."""
        self.vendre(self.awa, 3)
        periode = date.today().strftime("%Y-%m")
        services.calculer_primes(self.campagne, periode)
        prime = Prime.objects.get(commercial=self.awa, periode=periode)
        prime.versee_le = date.today()
        prime.save()

        self.vendre(self.bina, 10)
        services.calculer_primes(self.campagne, periode)
        prime.refresh_from_db()
        self.assertEqual(int(prime.montant), 25000)


class ReglesDeSaisie(Base):
    def test_un_commercial_uba_n_a_pas_d_agence(self):
        formulaire = CommercialSerializer(
            data={
                "identifiant": "nouveau@gdamali.net",
                "nom_complet": "Nouveau",
                "partenaire": self.uba.pk,
                "agence": self.agence_a.pk,
            }
        )
        with self.assertRaises(ValidationError):
            formulaire.is_valid(raise_exception=True)

    def test_une_agence_appartient_a_son_partenaire(self):
        autre = Partenaire.objects.create(code="X", nom="Autre banque")
        formulaire = CommercialSerializer(
            data={
                "identifiant": "nouveau@gdamali.net",
                "nom_complet": "Nouveau",
                "partenaire": autre.pk,
                "agence": self.agence_a.pk,
            }
        )
        with self.assertRaises(ValidationError):
            formulaire.is_valid(raise_exception=True)

    def test_le_detail_de_l_aide_doit_tomber_juste(self):
        """Sinon le commercial recoit autre chose que ce que son contrat annonce."""
        formulaire = CampagneSerializer(
            data={
                "nom": "Test",
                "date_debut": "2026-09-01",
                "date_fin": "2026-09-30",
                "aide_hebdo_montant": 5000,
                "aide_hebdo_carburant": 3000,
                "aide_hebdo_credit_tel": 1000,
            }
        )
        with self.assertRaises(ValidationError):
            formulaire.is_valid(raise_exception=True)

    def test_un_detail_correct_passe(self):
        formulaire = CampagneSerializer(
            data={
                "nom": "Test",
                "date_debut": "2026-09-01",
                "date_fin": "2026-09-30",
                "aide_hebdo_montant": 5000,
                "aide_hebdo_carburant": 3000,
                "aide_hebdo_credit_tel": 2000,
            }
        )
        self.assertTrue(formulaire.is_valid(), formulaire.errors)


class RapportsTelephoniques(Base):
    def test_taux_d_aboutissement(self):
        rapport = RapportTelephonique(appels_emis=100, appels_aboutis=42)
        self.assertEqual(rapport.taux_aboutissement, 42.0)

    def test_taux_sans_appel(self):
        self.assertEqual(RapportTelephonique().taux_aboutissement, 0)


class Reclamations(Base):
    def setUp(self):
        super().setUp()
        self.client_carte = Client.objects.create(
            commercial=self.awa,
            agence=self.agence_a,
            type_carte=self.carte_bdm,
            prenom="Fatoumata",
            nom="Diarra",
        )

    def test_la_date_de_resolution_suit_le_statut(self):
        """Tenir les deux separes produisait des resolutions sans date."""
        reclamation = Reclamation.objects.create(
            client=self.client_carte,
            commercial=self.awa,
            type_reclamation="ACTIVATION",
        )
        self.assertIsNone(reclamation.resolue_le)

        reclamation.statut = StatutReclamation.RESOLUE
        reclamation.save()
        self.assertIsNotNone(reclamation.resolue_le)

        reclamation.statut = StatutReclamation.EN_COURS
        reclamation.save()
        self.assertIsNone(reclamation.resolue_le)
