"""Representations JSON du domaine Finance."""

from rest_framework import serializers

from gdahub_common.validation.serializers import DocumentValidableSerializer
from finance.models import (
    ApprovisionnementCaisse,
    BaremePerdiem,
    BonCommande,
    Caisse,
    CategorieDepense,
    ConsommationCommunication,
    DemandePrix,
    Depense,
    ForfaitCommunication,
    Fournisseur,
    LigneFraisMission,
    LigneRequisition,
    Mission,
    OffreFournisseur,
    Prestation,
    Requisition,
    SortieCaisse,
)

CHAMPS_DEMANDEUR = DocumentValidableSerializer.CHAMPS_DEMANDEUR
CHAMPS_CIRCUIT = DocumentValidableSerializer.CHAMPS_CIRCUIT


class FournisseurSerializer(serializers.ModelSerializer):
    class Meta:
        model = Fournisseur
        fields = [
            "id",
            "code",
            "raison_sociale",
            "categorie",
            "contact",
            "telephone",
            "email",
            "adresse",
            "numero_fiscal",
            "actif",
        ]


class CategorieDepenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategorieDepense
        fields = ["id", "code", "libelle", "imputation", "actif"]


# --- Requisitions ----------------------------------------------------------


class LigneRequisitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = LigneRequisition
        fields = [
            "id",
            "requisition",
            "designation",
            "quantite",
            "unite",
            "prix_unitaire",
            "montant",
        ]
        read_only_fields = ["montant"]


class RequisitionSerializer(DocumentValidableSerializer):
    lignes = LigneRequisitionSerializer(many=True, read_only=True)
    priorite_libelle = serializers.CharField(
        source="get_priorite_display", read_only=True
    )

    class Meta:
        model = Requisition
        fields = [
            "id",
            "objet",
            "justification",
            "date_besoin",
            "priorite",
            "priorite_libelle",
            "montant",
            "devise",
            "departement_id",
            "departement_nom",
            "lignes",
            *CHAMPS_DEMANDEUR,
            *CHAMPS_CIRCUIT,
        ]
        # Le montant se deduit des lignes : le laisser saisir ferait router la
        # demande sur un chiffre qui ne correspond a rien.
        read_only_fields = ["montant", *CHAMPS_DEMANDEUR, *CHAMPS_CIRCUIT]


# --- Consultations et achats -----------------------------------------------


class OffreFournisseurSerializer(serializers.ModelSerializer):
    fournisseur_nom = serializers.CharField(
        source="fournisseur.raison_sociale", read_only=True
    )

    class Meta:
        model = OffreFournisseur
        fields = [
            "id",
            "demande_prix",
            "fournisseur",
            "fournisseur_nom",
            "montant",
            "devise",
            "delai_livraison_jours",
            "conditions_paiement",
            "note_technique",
            "retenue",
            "commentaire",
        ]


class DemandePrixSerializer(serializers.ModelSerializer):
    offres = OffreFournisseurSerializer(many=True, read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    nb_offres = serializers.SerializerMethodField()

    class Meta:
        model = DemandePrix
        fields = [
            "id",
            "numero",
            "requisition",
            "objet",
            "description",
            "date_lancement",
            "date_limite",
            "critere_attribution",
            "statut",
            "statut_libelle",
            "acheteur_identifiant",
            "acheteur_nom",
            "offres",
            "nb_offres",
            "cree_le",
        ]
        read_only_fields = ["numero", "acheteur_identifiant", "acheteur_nom"]

    def get_nb_offres(self, demande) -> int:
        return demande.offres.count()


class BonCommandeSerializer(DocumentValidableSerializer):
    fournisseur_nom = serializers.CharField(
        source="fournisseur.raison_sociale", read_only=True
    )

    class Meta:
        model = BonCommande
        fields = [
            "id",
            "requisition",
            "demande_prix",
            "fournisseur",
            "fournisseur_nom",
            "objet",
            "montant",
            "devise",
            "date_livraison_prevue",
            "date_livraison_reelle",
            "conditions",
            *CHAMPS_DEMANDEUR,
            *CHAMPS_CIRCUIT,
        ]
        read_only_fields = [*CHAMPS_DEMANDEUR, *CHAMPS_CIRCUIT]


# --- Caisse ----------------------------------------------------------------


class CaisseSerializer(serializers.ModelSerializer):
    solde_actuel = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )
    total_approvisionne = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )
    total_decaisse = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )
    sous_alerte = serializers.BooleanField(read_only=True)

    class Meta:
        model = Caisse
        fields = [
            "id",
            "code",
            "libelle",
            "responsable_identifiant",
            "responsable_nom",
            "devise",
            "solde_initial",
            "plafond_alerte",
            "solde_actuel",
            "total_approvisionne",
            "total_decaisse",
            "sous_alerte",
            "actif",
        ]


class ApprovisionnementCaisseSerializer(serializers.ModelSerializer):
    caisse_libelle = serializers.CharField(source="caisse.libelle", read_only=True)

    class Meta:
        model = ApprovisionnementCaisse
        fields = [
            "id",
            "caisse",
            "caisse_libelle",
            "montant",
            "date_operation",
            "reference",
            "commentaire",
            "enregistre_par_identifiant",
            "enregistre_par_nom",
        ]
        read_only_fields = ["enregistre_par_identifiant", "enregistre_par_nom"]


class SortieCaisseSerializer(DocumentValidableSerializer):
    caisse_libelle = serializers.CharField(source="caisse.libelle", read_only=True)
    categorie_libelle = serializers.CharField(
        source="categorie.libelle", read_only=True, default=""
    )

    class Meta:
        model = SortieCaisse
        fields = [
            "id",
            "caisse",
            "caisse_libelle",
            "categorie",
            "categorie_libelle",
            "beneficiaire",
            "beneficiaire_identifiant",
            "motif",
            "montant",
            "devise",
            "date_sortie",
            "piece_justificative",
            "date_decaissement",
            "decaisse_par_identifiant",
            *CHAMPS_DEMANDEUR,
            *CHAMPS_CIRCUIT,
        ]
        read_only_fields = [
            "date_decaissement",
            "decaisse_par_identifiant",
            *CHAMPS_DEMANDEUR,
            *CHAMPS_CIRCUIT,
        ]


class DepenseSerializer(DocumentValidableSerializer):
    categorie_libelle = serializers.CharField(source="categorie.libelle", read_only=True)
    fournisseur_nom = serializers.CharField(
        source="fournisseur.raison_sociale", read_only=True, default=""
    )
    mode_paiement_libelle = serializers.CharField(
        source="get_mode_paiement_display", read_only=True
    )

    class Meta:
        model = Depense
        fields = [
            "id",
            "categorie",
            "categorie_libelle",
            "fournisseur",
            "fournisseur_nom",
            "libelle",
            "description",
            "montant",
            "devise",
            "date_depense",
            "mode_paiement",
            "mode_paiement_libelle",
            "reference_paiement",
            "piece_justificative",
            "departement_id",
            "departement_nom",
            *CHAMPS_DEMANDEUR,
            *CHAMPS_CIRCUIT,
        ]
        read_only_fields = [*CHAMPS_DEMANDEUR, *CHAMPS_CIRCUIT]


# --- Missions --------------------------------------------------------------


class BaremePerdiemSerializer(serializers.ModelSerializer):
    zone_libelle = serializers.CharField(source="get_zone_display", read_only=True)

    class Meta:
        model = BaremePerdiem
        fields = [
            "id",
            "libelle",
            "zone",
            "zone_libelle",
            "role_agent",
            "montant_jour",
            "devise",
            "actif",
        ]


class LigneFraisMissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = LigneFraisMission
        fields = [
            "id",
            "mission",
            "libelle",
            "categorie",
            "montant",
            "date_depense",
            "justificatif",
            "valide",
        ]
        read_only_fields = ["valide"]


class MissionSerializer(DocumentValidableSerializer):
    frais = LigneFraisMissionSerializer(many=True, read_only=True)
    zone_libelle = serializers.CharField(source="get_zone_display", read_only=True)

    class Meta:
        model = Mission
        fields = [
            "id",
            "objet",
            "destination",
            "zone",
            "zone_libelle",
            "date_depart",
            "date_retour",
            "moyen_transport",
            "participants",
            "bareme",
            "nb_jours",
            "montant_perdiem",
            "frais_transport",
            "frais_hebergement",
            "autres_frais",
            "montant",
            "devise",
            "rapport",
            "date_rapport",
            "frais",
            *CHAMPS_DEMANDEUR,
            *CHAMPS_CIRCUIT,
        ]
        read_only_fields = [
            "nb_jours",
            "montant_perdiem",
            "montant",
            *CHAMPS_DEMANDEUR,
            *CHAMPS_CIRCUIT,
        ]

    def validate(self, donnees):
        depart = donnees.get("date_depart", getattr(self.instance, "date_depart", None))
        retour = donnees.get("date_retour", getattr(self.instance, "date_retour", None))
        if depart and retour and retour < depart:
            raise serializers.ValidationError(
                {"date_retour": "Le retour ne peut pas preceder le depart."}
            )
        return donnees


class PrestationSerializer(DocumentValidableSerializer):
    prestataire_nom = serializers.CharField(
        source="prestataire.raison_sociale", read_only=True
    )

    class Meta:
        model = Prestation
        fields = [
            "id",
            "prestataire",
            "prestataire_nom",
            "objet",
            "description",
            "date_debut",
            "date_fin",
            "montant",
            "devise",
            "livrables",
            "taux_execution",
            *CHAMPS_DEMANDEUR,
            *CHAMPS_CIRCUIT,
        ]
        read_only_fields = [*CHAMPS_DEMANDEUR, *CHAMPS_CIRCUIT]


# --- Communication ---------------------------------------------------------


class ConsommationCommunicationSerializer(serializers.ModelSerializer):
    depassement = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )

    class Meta:
        model = ConsommationCommunication
        fields = [
            "id",
            "forfait",
            "mois",
            "montant_consomme",
            "depassement",
            "commentaire",
        ]


class ForfaitCommunicationSerializer(serializers.ModelSerializer):
    consommations = ConsommationCommunicationSerializer(many=True, read_only=True)
    type_forfait_libelle = serializers.CharField(
        source="get_type_forfait_display", read_only=True
    )

    class Meta:
        model = ForfaitCommunication
        fields = [
            "id",
            "agent_identifiant",
            "agent_nom",
            "agent_departement_nom",
            "operateur",
            "numero_ligne",
            "type_forfait",
            "type_forfait_libelle",
            "montant_mensuel",
            "devise",
            "date_debut",
            "date_fin",
            "actif",
            "consommations",
        ]
