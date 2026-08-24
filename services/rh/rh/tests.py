"""Tests du domaine Ressources humaines et du circuit de validation.

    docker compose exec rh python manage.py test

C'est ici que le moteur de validation partage est reellement eprouve : `rh`
est le premier service a le monter, et une demande de conge est le document le
plus simple qui traverse un circuit complet.

Ce qui est garde : les regles qui casseraient sans bruit — un solde decompte
deux fois, un dossier modifiable apres un premier avis, un valideur qui
tranche sur sa propre demande. Le reste echoue franchement des le premier
appel.
"""

from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from gdahub_common.constantes import Decision, NatureEtape, StatutDocument
from gdahub_common.identite import UtilisateurJeton
from gdahub_common.validation import circuits
from gdahub_common.validation.models import RegleCircuit
from gdahub_common.validation.moteur import decider, soumettre
from rest_framework.exceptions import PermissionDenied, ValidationError

from rh import services
from rh.models import (
    CategorieAbsence,
    DemandeAbsence,
    Presence,
    SoldeConge,
    StatutPresence,
    TypeAbsence,
)
from rh.referentiels import charger_referentiels


def jeton(identifiant, *roles, nom="", superadmin=False):
    """Ce que l'authentification depose dans `request.user`."""
    return UtilisateurJeton(
        id=abs(hash(identifiant)) % 10000,
        identifiant=identifiant,
        nom_complet=nom or identifiant,
        est_superadmin=superadmin,
        roles=list(roles),
        habilitations={"rh": list(roles)},
    )


def contexte(identifiant, nom, responsable=None, departement=(1, "Finance")):
    """Ce que `organisation/mon-contexte` renvoie."""
    numero, libelle = departement
    fiche = {
        "agent_id": abs(hash(identifiant)) % 10000,
        "compte_id": abs(hash(identifiant)) % 10000,
        "identifiant": identifiant,
        "matricule": "GDA0001",
        "nom_complet": nom,
        "poste": "",
        "departement_id": numero,
        "departement_nom": libelle,
    }
    if responsable:
        fiche["responsable"] = {
            "agent_id": abs(hash(responsable[0])) % 10000,
            "compte_id": abs(hash(responsable[0])) % 10000,
            "identifiant": responsable[0],
            "matricule": "GDA0002",
            "nom_complet": responsable[1],
            "poste": "",
            "departement_id": numero,
            "departement_nom": libelle,
        }
    else:
        fiche["responsable"] = None
    return fiche


class BaseCircuit(TestCase):
    """Un circuit installe et une demande prete a partir."""

    def setUp(self):
        charger_referentiels()
        self.conge = TypeAbsence.objects.create(
            code="CA",
            libelle="Conge annuel",
            categorie=CategorieAbsence.CONGE,
            decompte_solde=True,
        )
        # Le circuit reel de GDA, avec deux postes nommement designes.
        self._installer_circuit()

        self.agent = jeton("awa@gdamali.net", "agent", nom="Awa Traore")
        self.chef = jeton("chef@gdamali.net", "agent", nom="Bina Chef")
        self.rh = jeton("rh@gdamali.net", "gestionnaire", nom="Rokia RH")
        self.operations = jeton("do@gdamali.net", "direction", nom="Directeur Operations")
        self.dg = jeton("dg@gdamali.net", "direction", nom="Directeur General")

    def _installer_circuit(self):
        """Le parcours de GDA, sans dependre du fichier d'effectif."""
        RegleCircuit.objects.all().delete()
        modeles = circuits.CIRCUITS["rh"]
        titulaires = {
            circuits.DIRECTEUR_OPERATIONS: ("do@gdamali.net", "Directeur Operations"),
            circuits.DIRECTEUR_GENERAL: ("dg@gdamali.net", "Directeur General"),
        }
        for modele in modeles:
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

    def demande(self, type_absence=None, jours=3, demandeur=None, responsable=("chef@gdamali.net", "Bina Chef")):
        porteur = demandeur or self.agent
        debut = date(2026, 9, 1)
        dossier = DemandeAbsence(
            type_absence=type_absence or self.conge,
            date_debut=debut,
            date_fin=debut + timedelta(days=jours - 1),
            motif="Repos annuel",
        )
        dossier.appliquer_contexte(
            contexte(porteur.identifiant, porteur.nom_complet, responsable)
        )
        dossier.save()
        return dossier


class ConstructionDuCircuit(BaseCircuit):
    def test_les_cinq_niveaux(self):
        dossier = self.demande()
        soumettre(dossier, self.agent)
        libelles = list(dossier.etapes.order_by("ordre").values_list("libelle", flat=True))
        self.assertEqual(
            libelles,
            [
                "Avis du responsable",
                "Service financier",
                "Avis des Ressources Humaines",
                "Avis du Directeur des Operations",
                "Decision du Directeur General",
            ],
        )

    def test_l_etape_hierarchique_vise_le_responsable_recopie(self):
        dossier = self.demande()
        soumettre(dossier, self.agent)
        etape = dossier.etapes.get(ordre=1)
        self.assertEqual(etape.valideur_identifiant, "chef@gdamali.net")
        self.assertEqual(etape.valideur_nom, "Bina Chef")

    def test_sans_responsable_l_etape_retombe_sur_le_role(self):
        """Un agent sans rattachement ne doit pas bloquer sa demande.

        L'etape revient alors a quiconque porte le role de repli — la
        direction — plutot que de designer personne.
        """
        dossier = self.demande(responsable=None)
        soumettre(dossier, self.agent)
        etape = dossier.etapes.get(ordre=1)
        self.assertEqual(etape.valideur_identifiant, "")
        self.assertEqual(etape.role_valideur, "direction")

    def test_l_etape_d_information_est_franchie_a_la_soumission(self):
        """Le financier ne se prononce pas sur un conge : il est tenu au courant.

        Sans ce franchissement automatique, le dossier resterait bloque chez
        quelqu'un a qui l'on ne demande rien.
        """
        dossier = self.demande()
        soumettre(dossier, self.agent)
        financier = dossier.etapes.get(libelle="Service financier")
        self.assertEqual(financier.nature, NatureEtape.INFORMATION)
        self.assertEqual(financier.decision, Decision.APPROUVE)
        self.assertEqual(financier.decide_par_identifiant, "")

    def test_le_demandeur_ne_figure_pas_dans_son_propre_circuit(self):
        """Le directeur general qui pose un conge ne se valide pas lui-meme."""
        dossier = self.demande(demandeur=self.dg, responsable=None)
        soumettre(dossier, self.dg)
        valideurs = set(
            dossier.etapes.values_list("valideur_identifiant", flat=True)
        )
        self.assertNotIn("dg@gdamali.net", valideurs)

    def test_une_personne_n_est_sollicitee_qu_une_fois(self):
        """Le responsable d'un agent est souvent le directeur cite plus loin.

        Sans dedoublonnage, il devrait se prononcer deux fois sur le meme
        dossier. On garde l'etape la plus engageante.
        """
        dossier = self.demande(responsable=("dg@gdamali.net", "Directeur General"))
        soumettre(dossier, self.agent)
        etapes_du_dg = dossier.etapes.filter(valideur_identifiant="dg@gdamali.net")
        self.assertEqual(etapes_du_dg.count(), 1)
        self.assertEqual(etapes_du_dg.first().nature, NatureEtape.DECISION)

    def test_numero_lisible_et_unique(self):
        premier = self.demande()
        second = self.demande()
        self.assertTrue(premier.numero.startswith("ABS-"))
        self.assertNotEqual(premier.numero, second.numero)


class Decisions(BaseCircuit):
    def test_un_avis_favorable_ne_clot_pas_le_dossier(self):
        dossier = self.demande()
        soumettre(dossier, self.agent)
        decider(dossier, self.chef, approuve=True)
        dossier.refresh_from_db()
        self.assertEqual(dossier.statut, StatutDocument.EN_VALIDATION)

    def test_la_decision_du_directeur_general_clot_le_dossier(self):
        dossier = self.demande()
        soumettre(dossier, self.agent)
        decider(dossier, self.dg, approuve=True)
        dossier.refresh_from_db()
        self.assertEqual(dossier.statut, StatutDocument.APPROUVE)

    def test_les_etapes_restantes_deviennent_sans_objet(self):
        """Le dossier disparait des files de ceux qui n'ont pas encore vu.

        Si le Directeur General accorde en premier, l'avis des autres n'a plus
        d'objet : le leur laisser en attente encombrerait leur ecran d'un
        dossier deja clos.
        """
        dossier = self.demande()
        soumettre(dossier, self.agent)
        decider(dossier, self.dg, approuve=True)
        self.assertFalse(
            dossier.etapes.filter(decision=Decision.EN_ATTENTE).exists()
        )
        self.assertTrue(dossier.etapes.filter(decision=Decision.IGNORE).exists())

    def test_un_refus_du_decideur_arrete_le_dossier(self):
        dossier = self.demande()
        soumettre(dossier, self.agent)
        decider(dossier, self.dg, approuve=False, commentaire="Periode chargee")
        dossier.refresh_from_db()
        self.assertEqual(dossier.statut, StatutDocument.REJETE)
        self.assertEqual(dossier.motif_rejet, "Periode chargee")

    def test_un_avis_defavorable_est_transmis(self):
        """Un avis n'engage pas : le dossier poursuit sa route.

        C'est ce qui permet a un responsable de signaler une reserve sans
        condamner la demande de son agent.
        """
        dossier = self.demande()
        soumettre(dossier, self.agent)
        decider(dossier, self.chef, approuve=False, commentaire="Equipe reduite")
        dossier.refresh_from_db()
        self.assertEqual(dossier.statut, StatutDocument.EN_VALIDATION)

    def test_un_avis_defavorable_puis_une_decision_favorable(self):
        dossier = self.demande()
        soumettre(dossier, self.agent)
        decider(dossier, self.chef, approuve=False, commentaire="Equipe reduite")
        decider(dossier, self.dg, approuve=True)
        dossier.refresh_from_db()
        self.assertEqual(dossier.statut, StatutDocument.APPROUVE)

    def test_nul_ne_tranche_sur_le_dossier_d_autrui_sans_etape(self):
        dossier = self.demande()
        soumettre(dossier, self.agent)
        with self.assertRaises(PermissionDenied):
            decider(dossier, jeton("tiers@gdamali.net", "agent"), approuve=True)

    def test_nul_ne_tranche_sur_son_propre_dossier(self):
        """Le garde-fou tient meme si le circuit a ete construit avant.

        Un changement de rattachement peut faire d'un demandeur le valideur de
        sa propre demande deja en circulation.
        """
        dossier = self.demande(responsable=("awa@gdamali.net", "Awa Traore"))
        soumettre(dossier, self.agent)
        with self.assertRaises(PermissionDenied):
            decider(dossier, self.agent, approuve=True)

    def test_un_seul_geste_regle_les_titres_cumules(self):
        """Une personne qui cumule les titres n'est sollicitee qu'une fois.

        Les habilitations vivant chez identity, on ne peut pas le savoir en
        construisant le circuit. On le regle donc a la decision, et chaque
        etape reste consignee separement — le journal montre a quel titre la
        personne s'est prononcee.
        """
        dossier = self.demande()
        soumettre(dossier, self.agent)
        # Le responsable est aussi gestionnaire RH : deux etapes lui reviennent.
        cumulard = jeton("chef@gdamali.net", "agent", "gestionnaire", nom="Bina Chef")
        decider(dossier, cumulard, approuve=True)
        reglees = dossier.etapes.filter(decide_par_identifiant="chef@gdamali.net")
        self.assertEqual(reglees.count(), 2)
        self.assertEqual(
            set(reglees.values_list("libelle", flat=True)),
            {"Avis du responsable", "Avis des Ressources Humaines"},
        )

    def test_on_ne_decide_pas_deux_fois(self):
        dossier = self.demande()
        soumettre(dossier, self.agent)
        decider(dossier, self.chef, approuve=True)
        with self.assertRaises(PermissionDenied):
            decider(dossier, self.chef, approuve=True)


class MainDuDemandeur(BaseCircuit):
    """Une demande appartient a son auteur tant que personne ne s'est prononce."""

    def test_soumettre_ne_verrouille_pas(self):
        from gdahub_common.validation.moteur import raison_verrou

        dossier = self.demande()
        soumettre(dossier, self.agent)
        self.assertIsNone(raison_verrou(dossier))

    def test_un_premier_avis_verrouille(self):
        from gdahub_common.validation.moteur import raison_verrou

        dossier = self.demande()
        soumettre(dossier, self.agent)
        decider(dossier, self.chef, approuve=True)
        dossier.refresh_from_db()
        self.assertIsNotNone(raison_verrou(dossier))

    def test_une_etape_pour_information_ne_verrouille_pas(self):
        """Elle est franchie sans que quiconque agisse : c'est un geste humain
        que l'on guette, pas un changement de statut."""
        from gdahub_common.validation.moteur import raison_verrou

        dossier = self.demande()
        soumettre(dossier, self.agent)
        self.assertTrue(
            dossier.etapes.filter(
                nature=NatureEtape.INFORMATION, decision=Decision.APPROUVE
            ).exists()
        )
        self.assertIsNone(raison_verrou(dossier))

    def test_un_dossier_tranche_est_verrouille(self):
        from gdahub_common.validation.moteur import raison_verrou

        dossier = self.demande()
        soumettre(dossier, self.agent)
        decider(dossier, self.dg, approuve=True)
        dossier.refresh_from_db()
        self.assertIn("approuve", raison_verrou(dossier))

    def test_seul_le_demandeur_soumet(self):
        dossier = self.demande()
        with self.assertRaises(PermissionDenied):
            soumettre(dossier, self.chef)

    def test_on_ne_soumet_pas_deux_fois(self):
        dossier = self.demande()
        soumettre(dossier, self.agent)
        with self.assertRaises(ValidationError):
            soumettre(dossier, self.agent)


class EffetsDeLApprobation(BaseCircuit):
    """Ce qui se produit au terme du circuit, et seulement la."""

    def test_le_solde_est_decompte(self):
        dossier = self.demande(jours=3)
        soumettre(dossier, self.agent)
        decider(dossier, self.dg, approuve=True)
        solde = SoldeConge.objects.get(
            agent_identifiant="awa@gdamali.net", annee=2026
        )
        self.assertEqual(solde.jours_pris, Decimal("3.0"))
        self.assertEqual(solde.jours_restants, Decimal("27.0"))

    def test_rien_n_est_decompte_avant_la_decision(self):
        """Une demande en circulation ne coute encore rien a son auteur."""
        dossier = self.demande(jours=3)
        soumettre(dossier, self.agent)
        decider(dossier, self.chef, approuve=True)
        self.assertFalse(
            SoldeConge.objects.filter(agent_identifiant="awa@gdamali.net").exists()
        )

    def test_une_demande_rejetee_ne_coute_rien(self):
        dossier = self.demande(jours=3)
        soumettre(dossier, self.agent)
        decider(dossier, self.dg, approuve=False, commentaire="Non")
        self.assertFalse(
            SoldeConge.objects.filter(agent_identifiant="awa@gdamali.net").exists()
        )

    def test_les_journees_sont_marquees_au_registre(self):
        dossier = self.demande(jours=3)
        soumettre(dossier, self.agent)
        decider(dossier, self.dg, approuve=True)
        presences = Presence.objects.filter(agent_identifiant="awa@gdamali.net")
        self.assertEqual(presences.count(), 3)
        self.assertEqual(presences.first().statut, StatutPresence.CONGE)

    def test_une_permission_n_entame_pas_le_solde(self):
        """C'est ce qui la distingue d'un conge, et sa raison d'exister."""
        permission = TypeAbsence.objects.get(code="PERMISSION")
        dossier = self.demande(type_absence=permission, jours=1)
        soumettre(dossier, self.agent)
        decider(dossier, self.dg, approuve=True)
        self.assertFalse(
            SoldeConge.objects.filter(agent_identifiant="awa@gdamali.net").exists()
        )

    def test_une_permission_marque_l_absence(self):
        permission = TypeAbsence.objects.get(code="PERMISSION")
        dossier = self.demande(type_absence=permission, jours=1)
        soumettre(dossier, self.agent)
        decider(dossier, self.dg, approuve=True)
        presence = Presence.objects.get(agent_identifiant="awa@gdamali.net")
        self.assertEqual(presence.statut, StatutPresence.ABSENT)

    def test_un_retard_ne_marque_pas_la_journee(self):
        """L'agent est venu : sa journee ne devient pas une absence."""
        retard = TypeAbsence.objects.get(code="RETARD")
        dossier = self.demande(type_absence=retard, jours=1)
        soumettre(dossier, self.agent)
        decider(dossier, self.dg, approuve=True)
        self.assertFalse(
            Presence.objects.filter(agent_identifiant="awa@gdamali.net").exists()
        )

    def test_une_demi_journee_compte_pour_un_demi(self):
        dossier = self.demande(jours=1)
        dossier.demi_journee = True
        dossier.save()
        soumettre(dossier, self.agent)
        decider(dossier, self.dg, approuve=True)
        solde = SoldeConge.objects.get(agent_identifiant="awa@gdamali.net")
        self.assertEqual(solde.jours_pris, Decimal("0.5"))


class SansCircuit(TestCase):
    """Sans regle applicable, un document est approuve d'office.

    Ce n'est pas un accident : c'est le comportement de l'application
    d'origine, et il rend l'absence de circuit visible immediatement plutot
    que de bloquer tout le monde en silence.
    """

    def setUp(self):
        charger_referentiels()
        self.type = TypeAbsence.objects.create(
            code="CA", libelle="Conge annuel", categorie=CategorieAbsence.CONGE
        )

    def test_approbation_directe(self):
        dossier = DemandeAbsence(
            type_absence=self.type,
            date_debut=date(2026, 9, 1),
            date_fin=date(2026, 9, 1),
            motif="Test",
        )
        dossier.appliquer_contexte(contexte("awa@gdamali.net", "Awa", None))
        dossier.save()
        soumettre(dossier, jeton("awa@gdamali.net", "agent"))
        dossier.refresh_from_db()
        self.assertEqual(dossier.statut, StatutDocument.APPROUVE)
        self.assertEqual(dossier.etapes.count(), 0)


class Referentiels(TestCase):
    def test_les_deux_types_imposes(self):
        retard, permission = charger_referentiels()
        self.assertEqual(retard.categorie, CategorieAbsence.RETARD)
        self.assertEqual(permission.categorie, CategorieAbsence.PERMISSION)
        self.assertFalse(retard.decompte_solde)
        self.assertFalse(permission.decompte_solde)

    def test_rejouable(self):
        charger_referentiels()
        charger_referentiels()
        self.assertEqual(TypeAbsence.objects.filter(code="RETARD").count(), 1)

    def test_un_libelle_inedit_n_entame_pas_le_solde(self):
        """Sur la foi d'un texte libre, on ne retire de jours a personne."""
        type_absence = services.materialiser_type("Conge sabbatique")
        self.assertFalse(type_absence.decompte_solde)
        self.assertEqual(type_absence.categorie, CategorieAbsence.CONGE)

    def test_un_libelle_connu_est_reutilise(self):
        existant = TypeAbsence.objects.create(
            code="CA", libelle="Conge annuel", categorie=CategorieAbsence.CONGE
        )
        self.assertEqual(services.type_par_libelle("conge ANNUEL"), existant)

    def test_les_codes_ne_se_marchent_pas_dessus(self):
        premier = services.materialiser_type("Formation externe")
        second = services.materialiser_type("Formation externe longue")
        self.assertNotEqual(premier.code, second.code)
