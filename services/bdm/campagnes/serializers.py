"""Representations JSON du domaine Campagnes."""

from rest_framework import serializers

from campagnes.models import (
    AdhesionCarte,
    Agence,
    Campagne,
    Client,
    Commercial,
    Enrolement,
    Partenaire,
    Prime,
    RapportTelephonique,
    Reclamation,
    ReponseContrat,
    TypeCarte,
    Vente,
    VersementAide,
)


class PartenaireSerializer(serializers.ModelSerializer):
    a_des_agences = serializers.BooleanField(read_only=True)
    organisation_libelle = serializers.CharField(
        source="get_organisation_display", read_only=True
    )

    class Meta:
        model = Partenaire
        fields = [
            "id",
            "code",
            "nom",
            "nom_complet",
            "organisation",
            "organisation_libelle",
            "a_des_agences",
            "fiche_adhesion",
            "ordre",
            "actif",
        ]


class AgenceSerializer(serializers.ModelSerializer):
    partenaire_nom = serializers.CharField(source="partenaire.nom", read_only=True)

    class Meta:
        model = Agence
        fields = [
            "id",
            "partenaire",
            "partenaire_nom",
            "nom",
            "adresse",
            "ordre",
            "chef_identifiant",
            "chef_nom",
            "actif",
        ]


class TypeCarteSerializer(serializers.ModelSerializer):
    class Meta:
        model = TypeCarte
        fields = ["id", "partenaire", "code", "libelle", "actif"]


class CommercialSerializer(serializers.ModelSerializer):
    partenaire_nom = serializers.CharField(
        source="partenaire.nom", read_only=True, default=""
    )
    agence_nom = serializers.CharField(source="agence.nom", read_only=True, default="")

    class Meta:
        model = Commercial
        fields = [
            "id",
            "identifiant",
            "nom_complet",
            "telephone",
            "partenaire",
            "partenaire_nom",
            "agence",
            "agence_nom",
            "telephonique",
            "adresse_contrat",
            "piece_identite_ref",
            "actif",
        ]

    def validate(self, donnees):
        """Un commercial d'un partenaire sans agences n'en a pas.

        Lui en attribuer une le ferait apparaitre dans des decoupages qui
        n'ont pas de sens pour son partenaire.
        """
        partenaire = donnees.get("partenaire", getattr(self.instance, "partenaire", None))
        agence = donnees.get("agence", getattr(self.instance, "agence", None))
        if agence and partenaire and not partenaire.a_des_agences:
            raise serializers.ValidationError(
                {
                    "agence": f"{partenaire.nom} n'a pas de reseau d'agences : "
                    "ses commerciaux dependent directement du partenaire."
                }
            )
        if agence and partenaire and agence.partenaire_id != partenaire.pk:
            raise serializers.ValidationError(
                {"agence": "Cette agence appartient a un autre partenaire."}
            )
        return donnees


class CampagneSerializer(serializers.ModelSerializer):
    partenaire_nom = serializers.CharField(
        source="partenaire.nom", read_only=True, default=""
    )
    statut_effectif = serializers.CharField(read_only=True)
    ouverte = serializers.BooleanField(read_only=True)
    sans_agences = serializers.BooleanField(read_only=True)
    type_campagne_libelle = serializers.CharField(
        source="get_type_campagne_display", read_only=True
    )

    class Meta:
        model = Campagne
        fields = [
            "id",
            "partenaire",
            "partenaire_nom",
            "nom",
            "type_campagne",
            "type_campagne_libelle",
            "date_debut",
            "date_fin",
            "statut",
            "statut_effectif",
            "ouverte",
            "sans_agences",
            "toutes_agences",
            "agences",
            "contrat_tous_commerciaux",
            "signataires",
            "prime_meilleur_vendeur",
            "aide_hebdo_active",
            "aide_hebdo_montant",
            "aide_hebdo_carburant",
            "aide_hebdo_credit_tel",
            "aide_hebdo_tous",
            "contrat_emolument",
            "contrat_forfait_communication",
            "contrat_forfait_deplacement",
            "contrat_representant",
            "contrat_lieu_signature",
            "contrat_clause_libre",
            "contrat_publie_le",
            "actif",
        ]

    def validate(self, donnees):
        debut = donnees.get("date_debut", getattr(self.instance, "date_debut", None))
        fin = donnees.get("date_fin", getattr(self.instance, "date_fin", None))
        if debut and fin and fin < debut:
            raise serializers.ValidationError(
                {"date_fin": "La fin de campagne doit suivre son debut."}
            )

        montant = donnees.get(
            "aide_hebdo_montant", getattr(self.instance, "aide_hebdo_montant", 0)
        )
        carburant = donnees.get(
            "aide_hebdo_carburant", getattr(self.instance, "aide_hebdo_carburant", 0)
        )
        credit = donnees.get(
            "aide_hebdo_credit_tel", getattr(self.instance, "aide_hebdo_credit_tel", 0)
        )
        # Le detail doit tomber juste : sinon le commercial recoit un montant
        # qui ne correspond pas a ce que son contrat annonce.
        if carburant + credit != montant:
            raise serializers.ValidationError(
                {
                    "aide_hebdo_montant": f"Le detail ne correspond pas au total : "
                    f"{carburant} + {credit} au lieu de {montant}."
                }
            )
        return donnees


class ClientSerializer(serializers.ModelSerializer):
    nom_complet = serializers.CharField(read_only=True)
    corrigible = serializers.BooleanField(read_only=True)
    commercial_nom = serializers.CharField(
        source="commercial.nom_complet", read_only=True
    )

    class Meta:
        model = Client
        fields = [
            "id",
            "commercial",
            "commercial_nom",
            "agence",
            "type_carte",
            "prenom",
            "nom",
            "nom_complet",
            "telephone",
            "ville",
            "quartier",
            "statut_carte",
            "piece_identite",
            "corrigible",
            "cree_le",
        ]
        read_only_fields = ["commercial", "agence"]


class VenteSerializer(serializers.ModelSerializer):
    client_nom = serializers.CharField(source="client.nom_complet", read_only=True)
    type_carte_libelle = serializers.CharField(
        source="type_carte.libelle", read_only=True
    )
    commercial_nom = serializers.CharField(
        source="commercial.nom_complet", read_only=True
    )
    agence_nom = serializers.CharField(source="agence.nom", read_only=True, default="")
    corrigible = serializers.BooleanField(read_only=True)
    adhesion_requise = serializers.SerializerMethodField()

    class Meta:
        model = Vente
        fields = [
            "id",
            "campagne",
            "client",
            "client_nom",
            "type_carte",
            "type_carte_libelle",
            "commercial",
            "commercial_nom",
            "agence",
            "agence_nom",
            "statut_activation",
            "corrigible",
            "adhesion_requise",
            "cree_le",
        ]
        read_only_fields = ["commercial", "agence"]

    def get_adhesion_requise(self, vente) -> bool:
        """Certains partenaires exigent une fiche d'adhesion par vente."""
        campagne = vente.campagne
        if campagne is None or campagne.partenaire is None:
            return False
        return campagne.partenaire.fiche_adhesion and not hasattr(vente, "adhesion")


class EnrolementSerializer(serializers.ModelSerializer):
    nom_complet = serializers.CharField(read_only=True)
    corrigible = serializers.BooleanField(read_only=True)
    commercial_nom = serializers.CharField(
        source="commercial.nom_complet", read_only=True
    )

    class Meta:
        model = Enrolement
        fields = [
            "id",
            "campagne",
            "commercial",
            "commercial_nom",
            "agence",
            "nom",
            "prenom",
            "nom_complet",
            "numero_compte",
            "telephone",
            "adresse",
            "corrigible",
            "cree_le",
        ]
        read_only_fields = ["commercial", "agence"]

    def validate_numero_compte(self, valeur):
        if not (valeur or "").strip():
            raise serializers.ValidationError(
                "Le numero de compte est obligatoire pour un enrolement."
            )
        return valeur.strip()


class AdhesionCarteSerializer(serializers.ModelSerializer):
    nom_complet = serializers.CharField(read_only=True)

    class Meta:
        model = AdhesionCarte
        fields = [
            "id",
            "vente",
            "nom",
            "prenoms",
            "nom_complet",
            "date_naissance",
            "lieu_naissance",
            "nationalite",
            "telephone",
            "email",
            "adresse",
            "pays_residence",
            "ville",
            "quartier",
            "nom_sur_carte",
            "piece_type",
            "piece_numero",
            "piece_delivree_le",
            "piece_expire_le",
            "piece_autorite",
            "numero_compte",
            "profession",
            "employeur",
        ]


class ReponseContratSerializer(serializers.ModelSerializer):
    commercial_nom = serializers.CharField(
        source="commercial.nom_complet", read_only=True
    )
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)

    class Meta:
        model = ReponseContrat
        fields = [
            "id",
            "campagne",
            "commercial",
            "commercial_nom",
            "statut",
            "statut_libelle",
            "repondu_le",
            "motif_refus",
        ]
        read_only_fields = ["repondu_le"]


class VersementAideSerializer(serializers.ModelSerializer):
    commercial_nom = serializers.CharField(
        source="commercial.nom_complet", read_only=True
    )

    class Meta:
        model = VersementAide
        fields = [
            "id",
            "campagne",
            "commercial",
            "commercial_nom",
            "semaine_debut",
            "montant",
            "verse_le",
            "accuse_le",
        ]


class RapportTelephoniqueSerializer(serializers.ModelSerializer):
    commercial_nom = serializers.CharField(
        source="commercial.nom_complet", read_only=True
    )
    taux_aboutissement = serializers.FloatField(read_only=True)

    class Meta:
        model = RapportTelephonique
        fields = [
            "id",
            "commercial",
            "commercial_nom",
            "campagne",
            "date_rapport",
            "appels_emis",
            "appels_aboutis",
            "rendez_vous",
            "cartes_vendues",
            "taux_aboutissement",
            "commentaire",
        ]
        read_only_fields = ["commercial"]

    def validate(self, donnees):
        emis = donnees.get("appels_emis", getattr(self.instance, "appels_emis", 0))
        aboutis = donnees.get(
            "appels_aboutis", getattr(self.instance, "appels_aboutis", 0)
        )
        if aboutis > emis:
            raise serializers.ValidationError(
                {"appels_aboutis": "Il ne peut pas y avoir plus d'aboutis que d'emis."}
            )
        return donnees


class PrimeSerializer(serializers.ModelSerializer):
    commercial_nom = serializers.CharField(
        source="commercial.nom_complet", read_only=True
    )
    campagne_nom = serializers.CharField(
        source="campagne.nom", read_only=True, default=""
    )

    class Meta:
        model = Prime
        fields = [
            "id",
            "commercial",
            "commercial_nom",
            "campagne",
            "campagne_nom",
            "periode",
            "montant",
            "rang",
            "ventes_comptees",
            "versee_le",
        ]
        # La prime se calcule : la saisir a la main la deconnecterait des ventes.
        read_only_fields = ["montant", "rang", "ventes_comptees"]


class ReclamationSerializer(serializers.ModelSerializer):
    client_nom = serializers.CharField(source="client.nom_complet", read_only=True)
    type_libelle = serializers.CharField(
        source="get_type_reclamation_display", read_only=True
    )
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)

    class Meta:
        model = Reclamation
        fields = [
            "id",
            "client",
            "client_nom",
            "commercial",
            "type_reclamation",
            "type_libelle",
            "statut",
            "statut_libelle",
            "description",
            "resolue_le",
            "cree_le",
        ]
        read_only_fields = ["commercial", "resolue_le"]
