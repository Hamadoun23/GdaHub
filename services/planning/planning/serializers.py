"""Representations JSON du domaine Planning."""

from rest_framework import serializers

from planning.models import (
    Client,
    IdeeContenu,
    Publication,
    RapportClient,
    ReglePublication,
    StatutEcheance,
    Tournage,
)


class ReglePublicationSerializer(serializers.ModelSerializer):
    jour_libelle = serializers.CharField(source="get_jour_display", read_only=True)

    class Meta:
        model = ReglePublication
        fields = ["id", "client", "jour", "jour_libelle", "motif"]


class ClientSerializer(serializers.ModelSerializer):
    regles = ReglePublicationSerializer(many=True, read_only=True)

    class Meta:
        model = Client
        fields = [
            "id",
            "nom_entreprise",
            "contact",
            "telephone",
            "email",
            "compte_identifiant",
            "actif",
            "regles",
        ]


class IdeeContenuSerializer(serializers.ModelSerializer):
    type_contenu_libelle = serializers.CharField(
        source="get_type_contenu_display", read_only=True
    )

    class Meta:
        model = IdeeContenu
        fields = ["id", "titre", "type_contenu", "type_contenu_libelle", "notes"]


class EcheanceSerializer(serializers.ModelSerializer):
    """Ce que tournage et publication partagent a l'affichage."""

    client_nom = serializers.CharField(source="client.nom_entreprise", read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    en_retard = serializers.BooleanField(read_only=True)
    imminente = serializers.BooleanField(read_only=True)
    demande_une_action = serializers.BooleanField(read_only=True)

    CHAMPS = [
        "id",
        "client",
        "client_nom",
        "date",
        "statut",
        "statut_libelle",
        "description",
        "motif_statut",
        "en_retard",
        "imminente",
        "demande_une_action",
        "cree_le",
    ]

    def validate(self, donnees):
        """Un statut qui n'est pas celui espere doit s'expliquer.

        Sans motif, un planning se remplit de « non realise » dont personne ne
        sait plus la raison trois mois plus tard.
        """
        statut = donnees.get("statut", getattr(self.instance, "statut", None))
        motif = donnees.get("motif_statut", getattr(self.instance, "motif_statut", ""))
        if statut in {
            StatutEcheance.ANNULE,
            StatutEcheance.NON_REALISE,
            StatutEcheance.REPROGRAMME,
        } and not (motif or "").strip():
            raise serializers.ValidationError(
                {"motif_statut": "Precisez la raison de ce statut."}
            )
        return donnees


class TournageSerializer(EcheanceSerializer):
    idees_titres = serializers.SerializerMethodField()
    peut_etre_publie = serializers.SerializerMethodField()

    class Meta:
        model = Tournage
        fields = [*EcheanceSerializer.CHAMPS, "idees", "idees_titres", "peut_etre_publie"]

    def get_idees_titres(self, tournage) -> list[str]:
        return [idee.titre for idee in tournage.idees.all()]

    def get_peut_etre_publie(self, tournage) -> bool:
        return tournage.peut_etre_publie()


class PublicationSerializer(EcheanceSerializer):
    idee_titre = serializers.CharField(source="idee.titre", read_only=True, default="")
    jour = serializers.CharField(read_only=True)
    jour_deconseille = serializers.BooleanField(read_only=True)
    avertissement = serializers.CharField(read_only=True)

    class Meta:
        model = Publication
        fields = [
            *EcheanceSerializer.CHAMPS,
            "idee",
            "idee_titre",
            "tournage",
            "jour",
            "jour_deconseille",
            "avertissement",
        ]

    def validate(self, donnees):
        donnees = super().validate(donnees)
        tournage = donnees.get("tournage", getattr(self.instance, "tournage", None))
        client = donnees.get("client", getattr(self.instance, "client", None))

        if tournage is not None:
            if client is not None and tournage.client_id != client.pk:
                raise serializers.ValidationError(
                    {"tournage": "Ce tournage appartient a un autre client."}
                )
            # Un tournage deja publie compterait deux fois dans le bilan du
            # mois : on refuse plutot que de laisser le chiffre se gonfler.
            deja = tournage.publications.exclude(
                pk=self.instance.pk if self.instance else None
            ).exists()
            if deja:
                raise serializers.ValidationError(
                    {"tournage": "Ce tournage est deja rattache a une publication."}
                )
            if tournage.statut in {StatutEcheance.ANNULE, StatutEcheance.NON_REALISE}:
                raise serializers.ValidationError(
                    {"tournage": "Un tournage annule ou non realise ne se publie pas."}
                )
        return donnees


class RapportClientSerializer(serializers.ModelSerializer):
    client_nom = serializers.CharField(source="client.nom_entreprise", read_only=True)

    class Meta:
        model = RapportClient
        fields = [
            "id",
            "client",
            "client_nom",
            "mois",
            "annee",
            "contenu",
            "indicateurs",
            "telechargements",
            "genere_par_identifiant",
            "genere_par_nom",
            "cree_le",
        ]
        read_only_fields = [
            "indicateurs",
            "telechargements",
            "genere_par_identifiant",
            "genere_par_nom",
        ]
