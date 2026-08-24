"""Tests du domaine Finance.

    docker compose exec finance python manage.py test

Ce qui est garde : les calculs dont une erreur coute de l'argent — le montant
d'une requisition, le solde d'une caisse, le perdiem d'une mission — et les
gestes qui ne doivent se produire qu'une fois.
"""

from datetime import date
from decimal import Decimal

from django.test import TestCase
from gdahub_common.constantes import NatureEtape, StatutDocument, TypeDocument
from gdahub_common.identite import UtilisateurJeton
from gdahub_common.validation import circuits
from gdahub_common.validation.models import RegleCircuit
from gdahub_common.validation.moteur import decider, soumettre
from rest_framework.exceptions import ValidationError

from finance.models import (
    ApprovisionnementCaisse,
    BaremePerdiem,
    Caisse,
    CategorieDepense,
    ConsommationCommunication,
    DemandePrix,
    Depense,
    ForfaitCommunication,
    Fournisseur,
    LigneRequisition,
    Mission,
    OffreFournisseur,
    Requisition,
    SortieCaisse,
    ZoneMission,
)
from finance.referentiels import categorie_par_defaut


def jeton(identifiant, *roles, nom=""):
    return UtilisateurJeton(
        id=abs(hash(identifiant)) % 10000,
        identifiant=identifiant,
        nom_complet=nom or identifiant,
        roles=list(roles),
        habilitations={"finance": list(roles)},
    )


def contexte(identifiant, nom, responsable=None):
    fiche = {
        "agent_id": 1,
        "compte_id": 1,
        "identifiant": identifiant,
        "matricule": "GDA0001",
        "nom_complet": nom,
        "poste": "",
        "departement_id": 3,
        "departement_nom": "Finance",
    }
    fiche["responsable"] = (
        {
            "agent_id": 2,
            "compte_id": 2,
            "identifiant": responsable[0],
            "matricule": "GDA0002",
            "nom_complet": responsable[1],
            "poste": "",
            "departement_id": 3,
            "departement_nom": "Finance",
        }
        if responsable
        else None
    )
    return fiche


class Requisitions(TestCase):
    """Le montant d'une requisition se deduit de ses lignes, toujours."""

    def setUp(self):
        self.requisition = Requisition(objet="Fournitures de bureau")
        self.requisition.appliquer_contexte(contexte("awa@gdamali.net", "Awa Traore"))
        self.requisition.save()

    def test_montant_nul_sans_ligne(self):
        self.assertEqual(self.requisition.montant, Decimal("0"))

    def test_le_montant_suit_les_lignes(self):
        LigneRequisition.objects.create(
            requisition=self.requisition,
            designation="Ramettes A4",
            quantite=Decimal("10"),
            prix_unitaire=Decimal("3500"),
        )
        self.requisition.refresh_from_db()
        self.assertEqual(self.requisition.montant, Decimal("35000"))

    def test_le_montant_suit_une_suppression(self):
        ligne = LigneRequisition.objects.create(
            requisition=self.requisition,
            designation="Ramettes A4",
            quantite=Decimal("10"),
            prix_unitaire=Decimal("3500"),
        )
        ligne.delete()
        self.requisition.refresh_from_db()
        self.assertEqual(self.requisition.montant, Decimal("0"))

    def test_plusieurs_lignes_s_additionnent(self):
        for prix in (Decimal("1000"), Decimal("2500"), Decimal("500")):
            LigneRequisition.objects.create(
                requisition=self.requisition,
                designation="Article",
                quantite=Decimal("2"),
                prix_unitaire=prix,
            )
        self.requisition.refresh_from_db()
        self.assertEqual(self.requisition.montant, Decimal("8000"))

    def test_numero_prefixe_par_type(self):
        self.assertTrue(self.requisition.numero.startswith("REQ-"))


class CircuitDeLaDepense(TestCase):
    """Une depense traverse le meme circuit qu'un conge, avec ses regles."""

    def setUp(self):
        self.categorie = categorie_par_defaut()
        self._installer_circuit()
        self.agent = jeton("awa@gdamali.net", "agent", nom="Awa Traore")
        self.financier = jeton("fin@gdamali.net", "gestionnaire", nom="Drissa Finance")
        self.chef = jeton("chef@gdamali.net", "agent", nom="Bina Chef")
        self.dg = jeton("dg@gdamali.net", "direction", nom="Directeur General")

    def _installer_circuit(self):
        RegleCircuit.objects.all().delete()
        titulaires = {
            circuits.DIRECTEUR_OPERATIONS: ("do@gdamali.net", "Directeur Operations"),
            circuits.DIRECTEUR_GENERAL: ("dg@gdamali.net", "Directeur General"),
        }
        for modele in circuits.CIRCUITS["finance"]:
            if modele["type_document"] != TypeDocument.DEPENSE:
                continue
            identifiant, nom = titulaires.get(modele["poste"], ("", ""))
            RegleCircuit.objects.create(
                libelle=modele["libelle"],
                type_document=modele["type_document"],
                role_valideur=modele["role_valideur"],
                ordre=modele["ordre"],
                valideur_hierarchique=modele["valideur_hierarchique"],
                valideur_identifiant=identifiant,
                valideur_nom=nom,
                nature=modele["nature"],
            )

    def depense(self, montant=Decimal("150000")):
        document = Depense(
            categorie=self.categorie,
            libelle="Achat de fournitures",
            montant=montant,
            date_depense=date(2026, 9, 1),
        )
        document.appliquer_contexte(
            contexte("awa@gdamali.net", "Awa Traore", ("chef@gdamali.net", "Bina Chef"))
        )
        document.save()
        return document

    def test_le_financier_rend_un_avis_sur_une_depense(self):
        """Sur un conge il est seulement informe ; ici c'est son domaine."""
        document = self.depense()
        soumettre(document, self.agent)
        etape = document.etapes.get(libelle="Service financier")
        self.assertEqual(etape.nature, NatureEtape.AVIS)
        self.assertEqual(etape.role_valideur, "gestionnaire")

    def test_les_ressources_humaines_sont_seulement_informees(self):
        document = self.depense()
        soumettre(document, self.agent)
        etape = document.etapes.get(libelle="Avis des Ressources Humaines")
        self.assertEqual(etape.nature, NatureEtape.INFORMATION)

    def test_le_circuit_complet_aboutit(self):
        document = self.depense()
        soumettre(document, self.agent)
        decider(document, self.chef, approuve=True)
        decider(document, self.financier, approuve=True)
        decider(document, self.dg, approuve=True)
        document.refresh_from_db()
        self.assertEqual(document.statut, StatutDocument.APPROUVE)

    def test_un_refus_du_financier_ne_bloque_pas_seul(self):
        """Son avis est consultatif : le directeur general garde le dernier mot."""
        document = self.depense()
        soumettre(document, self.agent)
        decider(document, self.financier, approuve=False, commentaire="Hors budget")
        document.refresh_from_db()
        self.assertEqual(document.statut, StatutDocument.EN_VALIDATION)


class Caisses(TestCase):
    """Le solde d'une caisse se calcule, il ne se stocke pas."""

    def setUp(self):
        self.caisse = Caisse.objects.create(
            code="C1",
            libelle="Caisse centrale",
            solde_initial=Decimal("500000"),
            plafond_alerte=Decimal("100000"),
        )

    def test_solde_initial(self):
        self.assertEqual(self.caisse.solde_actuel, Decimal("500000"))

    def test_un_approvisionnement_augmente_le_solde(self):
        ApprovisionnementCaisse.objects.create(
            caisse=self.caisse,
            montant=Decimal("200000"),
            date_operation=date(2026, 9, 1),
        )
        self.assertEqual(self.caisse.solde_actuel, Decimal("700000"))

    def test_une_sortie_approuvee_ne_bouge_pas_le_solde(self):
        """Entre l'approbation et le decaissement, l'argent est engage mais la.

        Compter une sortie approuvee montrerait un solde plus bas que les
        especes reellement presentes dans le tiroir.
        """
        sortie = SortieCaisse(
            caisse=self.caisse,
            beneficiaire="Fournisseur X",
            motif="Achat urgent",
            montant=Decimal("50000"),
            date_sortie=date(2026, 9, 1),
            statut=StatutDocument.APPROUVE,
        )
        sortie.appliquer_contexte(contexte("awa@gdamali.net", "Awa"))
        sortie.save()
        self.assertEqual(self.caisse.solde_actuel, Decimal("500000"))

    def test_une_sortie_cloturee_diminue_le_solde(self):
        sortie = SortieCaisse(
            caisse=self.caisse,
            beneficiaire="Fournisseur X",
            motif="Achat urgent",
            montant=Decimal("50000"),
            date_sortie=date(2026, 9, 1),
            statut=StatutDocument.CLOTURE,
        )
        sortie.appliquer_contexte(contexte("awa@gdamali.net", "Awa"))
        sortie.save()
        self.assertEqual(self.caisse.solde_actuel, Decimal("450000"))

    def test_l_alerte_se_declenche_toute_seule(self):
        sortie = SortieCaisse(
            caisse=self.caisse,
            beneficiaire="X",
            motif="Y",
            montant=Decimal("450000"),
            date_sortie=date(2026, 9, 1),
            statut=StatutDocument.CLOTURE,
        )
        sortie.appliquer_contexte(contexte("awa@gdamali.net", "Awa"))
        sortie.save()
        self.assertTrue(self.caisse.sous_alerte)


class Missions(TestCase):
    """Le montant d'une mission se calcule : perdiem plus frais."""

    def setUp(self):
        self.bareme = BaremePerdiem.objects.create(
            libelle="National cadre",
            zone=ZoneMission.NATIONALE,
            montant_jour=Decimal("25000"),
        )

    def mission(self, **extra):
        document = Mission(
            objet="Suivi de chantier",
            destination="Segou",
            zone=ZoneMission.NATIONALE,
            date_depart=date(2026, 9, 1),
            date_retour=date(2026, 9, 3),
            bareme=self.bareme,
            **extra,
        )
        document.appliquer_contexte(contexte("awa@gdamali.net", "Awa Traore"))
        document.save()
        return document

    def test_duree_bornes_comprises(self):
        """Trois jours du 1er au 3 : le jour de retour compte."""
        self.assertEqual(self.mission().nb_jours, 3)

    def test_perdiem_selon_le_bareme(self):
        self.assertEqual(self.mission().montant_perdiem, Decimal("75000"))

    def test_le_total_ajoute_les_frais(self):
        document = self.mission(
            frais_transport=Decimal("40000"),
            frais_hebergement=Decimal("60000"),
            autres_frais=Decimal("5000"),
        )
        self.assertEqual(document.montant, Decimal("180000"))

    def test_une_mission_d_un_jour_compte_un_jour(self):
        document = Mission(
            objet="Reunion",
            destination="Bamako",
            date_depart=date(2026, 9, 1),
            date_retour=date(2026, 9, 1),
            bareme=self.bareme,
        )
        document.appliquer_contexte(contexte("awa@gdamali.net", "Awa"))
        document.save()
        self.assertEqual(document.nb_jours, 1)
        self.assertEqual(document.montant, Decimal("25000"))

    def test_sans_bareme_le_perdiem_reste_a_zero(self):
        document = Mission(
            objet="Reunion",
            destination="Bamako",
            date_depart=date(2026, 9, 1),
            date_retour=date(2026, 9, 2),
            frais_transport=Decimal("10000"),
        )
        document.appliquer_contexte(contexte("awa@gdamali.net", "Awa"))
        document.save()
        self.assertEqual(document.montant_perdiem, Decimal("0"))
        self.assertEqual(document.montant, Decimal("10000"))


class Consultations(TestCase):
    def setUp(self):
        self.fournisseur = Fournisseur.objects.create(
            code="F1", raison_sociale="Papeterie du Fleuve"
        )
        self.autre = Fournisseur.objects.create(code="F2", raison_sociale="Bureau Plus")
        self.consultation = DemandePrix.objects.create(objet="Fournitures")

    def test_numero_attribue(self):
        self.assertTrue(self.consultation.numero.startswith("DP-"))

    def test_offre_retenue(self):
        OffreFournisseur.objects.create(
            demande_prix=self.consultation,
            fournisseur=self.fournisseur,
            montant=Decimal("100000"),
        )
        gagnante = OffreFournisseur.objects.create(
            demande_prix=self.consultation,
            fournisseur=self.autre,
            montant=Decimal("90000"),
            retenue=True,
        )
        self.assertEqual(self.consultation.offre_retenue.pk, gagnante.pk)

    def test_pas_d_offre_retenue_au_depart(self):
        self.assertIsNone(self.consultation.offre_retenue)


class Communication(TestCase):
    def setUp(self):
        self.forfait = ForfaitCommunication.objects.create(
            agent_identifiant="awa@gdamali.net",
            agent_nom="Awa Traore",
            operateur="Orange",
            numero_ligne="70000000",
            montant_mensuel=Decimal("15000"),
            date_debut=date(2026, 1, 1),
        )

    def test_depassement_calcule(self):
        consommation = ConsommationCommunication.objects.create(
            forfait=self.forfait,
            mois=date(2026, 9, 1),
            montant_consomme=Decimal("22000"),
        )
        self.assertEqual(consommation.depassement, Decimal("7000"))

    def test_pas_de_depassement_negatif(self):
        consommation = ConsommationCommunication.objects.create(
            forfait=self.forfait,
            mois=date(2026, 9, 1),
            montant_consomme=Decimal("9000"),
        )
        self.assertEqual(consommation.depassement, Decimal("0"))


class Referentiels(TestCase):
    def test_categorie_par_defaut_rejouable(self):
        premiere = categorie_par_defaut()
        seconde = categorie_par_defaut()
        self.assertEqual(premiere.pk, seconde.pk)
        self.assertEqual(CategorieDepense.objects.filter(code="GEN").count(), 1)
