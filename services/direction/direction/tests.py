"""Tests du domaine Direction.

    docker compose exec direction python manage.py test

Ce service n'a presque pas de metier : ce qui merite d'etre garde, c'est son
comportement quand un autre service ne repond pas. Un tableau de bord qui
refuse de s'afficher parce qu'un domaine sur cinq est indisponible est moins
utile qu'un tableau de bord honnete.
"""

from datetime import date
from unittest.mock import patch

from django.test import TestCase, override_settings
from gdahub_common.client import ErreurService
from gdahub_common.identite import UtilisateurJeton

from direction import services
from direction.models import SyntheseMensuelle

SERVICES = {"rh": "http://rh:8000", "finance": "http://finance:8000"}


def directeur():
    return UtilisateurJeton(
        id=1,
        identifiant="dg@gdamali.net",
        nom_complet="Directeur General",
        roles=["membre"],
        habilitations={"direction": ["membre"]},
        jeton="jeton-de-test",
    )


@override_settings(GDAHUB_SERVICES=SERVICES)
class Consolidation(TestCase):
    def test_rassemble_les_deux_applications(self):
        with patch.object(services.ClientService, "get", return_value={"a_traiter": 4}):
            resultat = services.consolider(directeur())
        self.assertEqual(set(resultat), {"rh", "finance"})
        self.assertTrue(resultat["rh"]["disponible"])
        self.assertEqual(resultat["rh"]["indicateurs"]["a_traiter"], 4)

    def test_un_service_muet_n_interrompt_pas_la_consolidation(self):
        def repondre(self, chemin, params=None):
            if "/api/rh/" in chemin:
                raise ErreurService("rh", 503, "indisponible")
            return {"depenses_du_mois": 1200000}

        with patch.object(services.ClientService, "get", repondre):
            resultat = services.consolider(directeur())

        self.assertFalse(resultat["rh"]["disponible"])
        self.assertIn("indisponible", resultat["rh"]["motif"].lower())
        # L'autre application est servie normalement.
        self.assertTrue(resultat["finance"]["disponible"])

    def test_un_refus_de_droit_se_distingue_d_une_panne(self):
        """Le message doit dire lequel des deux : on ne relance pas un service
        qui fonctionne, on demande une habilitation."""

        def repondre(self, chemin, params=None):
            raise ErreurService("rh", 403, "interdit")

        with patch.object(services.ClientService, "get", repondre):
            resultat = services.consolider(directeur())
        self.assertIn("habilite", resultat["rh"]["motif"])

    def test_service_non_declare(self):
        with override_settings(GDAHUB_SERVICES={}):
            resultat = services.consolider(directeur())
        self.assertFalse(resultat["rh"]["disponible"])


@override_settings(GDAHUB_SERVICES=SERVICES)
class FilesDAttente(TestCase):
    def test_compte_les_dossiers_en_attente(self):
        with patch.object(services.ClientService, "get", return_value={"total": 7}):
            resultat = services.files_d_attente(directeur())
        self.assertEqual(resultat["rh"]["en_attente"], 7)
        self.assertEqual(resultat["finance"]["en_attente"], 7)

    def test_une_panne_ne_masque_pas_les_autres(self):
        def repondre(self, chemin, params=None):
            if "/api/rh/" in chemin:
                raise ErreurService("rh", 500, "boum")
            return {"total": 2}

        with patch.object(services.ClientService, "get", repondre):
            resultat = services.files_d_attente(directeur())
        self.assertFalse(resultat["rh"]["disponible"])
        self.assertEqual(resultat["finance"]["en_attente"], 2)


@override_settings(GDAHUB_SERVICES=SERVICES)
class Circuits(TestCase):
    def test_lit_les_regles_chez_le_service(self):
        with patch.object(
            services.ClientService, "get", return_value={"resultats": [{"ordre": 1}]}
        ):
            resultat = services.circuits_de("rh", directeur())
        self.assertTrue(resultat["disponible"])
        self.assertEqual(len(resultat["regles"]["resultats"]), 1)

    def test_application_inconnue(self):
        resultat = services.circuits_de("inexistante", directeur())
        self.assertFalse(resultat["disponible"])


class Syntheses(TestCase):
    """La seule donnee que ce service possede en propre."""

    def test_une_synthese_par_mois_et_application(self):
        SyntheseMensuelle.objects.create(
            mois=date(2026, 9, 1), application="rh", indicateurs={"a_traiter": 3}
        )
        SyntheseMensuelle.objects.update_or_create(
            mois=date(2026, 9, 1),
            application="rh",
            defaults={"indicateurs": {"a_traiter": 5}},
        )
        self.assertEqual(SyntheseMensuelle.objects.count(), 1)
        self.assertEqual(
            SyntheseMensuelle.objects.first().indicateurs["a_traiter"], 5
        )

    def test_deux_applications_coexistent_le_meme_mois(self):
        SyntheseMensuelle.objects.create(
            mois=date(2026, 9, 1), application="rh", indicateurs={}
        )
        SyntheseMensuelle.objects.create(
            mois=date(2026, 9, 1), application="finance", indicateurs={}
        )
        self.assertEqual(SyntheseMensuelle.objects.count(), 2)
