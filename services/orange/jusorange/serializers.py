"""Representations JSON du domaine Jus d'Orange."""

from rest_framework import serializers

from jusorange.models import (
    ArticleStock,
    Bouteille,
    ClientJus,
    Commande,
    Conditionnement,
    Cueillette,
    Facture,
    Inventaire,
    Paiement,
    PointVente,
    Producteur,
    Production,
    Reception,
    ReceptionPaiement,
    TypeProducteur,
    Vente,
    Visite,
)


class ProducteurSerializer(serializers.ModelSerializer):
    type_producteur_libelle = serializers.CharField(
        source="get_type_producteur_display", read_only=True
    )

    class Meta:
        model = Producteur
        fields = [
            "id",
            "nom_complet",
            "type_producteur",
            "type_producteur_libelle",
            "zone",
            "contact",
            "adresse",
            "actif",
        ]


class CueilletteSerializer(serializers.ModelSerializer):
    producteur_affiche = serializers.CharField(read_only=True)
    taux_qualite = serializers.FloatField(read_only=True)

    class Meta:
        model = Cueillette
        fields = [
            "id",
            "producteur",
            "producteur_nom",
            "producteur_affiche",
            "date_cueillette",
            "quantite_totale",
            "quantite_bonne",
            "quantite_mauvaise",
            "taux_qualite",
            "observation",
        ]
        read_only_fields = ["quantite_mauvaise", "producteur_nom"]

    def validate(self, donnees):
        totale = donnees.get(
            "quantite_totale", getattr(self.instance, "quantite_totale", 0)
        )
        bonne = donnees.get(
            "quantite_bonne", getattr(self.instance, "quantite_bonne", 0)
        )
        if bonne > totale:
            raise serializers.ValidationError(
                {"quantite_bonne": "La quantite bonne ne peut pas depasser le total."}
            )
        return donnees


class ArticleStockSerializer(serializers.ModelSerializer):
    type_article_libelle = serializers.CharField(
        source="get_type_article_display", read_only=True
    )
    sous_alerte = serializers.BooleanField(read_only=True)

    class Meta:
        model = ArticleStock
        fields = [
            "id",
            "type_article",
            "type_article_libelle",
            "quantite",
            "seuil_alerte",
            "sous_alerte",
            "prix_33cl",
            "prix_1l",
            "modifie_le",
        ]


class ReceptionSerializer(serializers.ModelSerializer):
    origine = serializers.CharField(read_only=True)
    taux_qualite = serializers.FloatField(read_only=True)
    etat_qualite = serializers.CharField(read_only=True)

    class Meta:
        model = Reception
        fields = [
            "id",
            "numero",
            "cueillette",
            "producteur_externe",
            "origine",
            "date_reception",
            "quantite_recue",
            "quantite_bonne",
            "quantite_mauvaise",
            "taux_qualite",
            "etat_qualite",
            "lieu_depot",
            "cause_perte",
        ]
        read_only_fields = ["numero", "quantite_mauvaise"]

    def validate(self, donnees):
        cueillette = donnees.get("cueillette", getattr(self.instance, "cueillette", None))
        externe = donnees.get(
            "producteur_externe", getattr(self.instance, "producteur_externe", None)
        )

        if cueillette and externe:
            raise serializers.ValidationError(
                {
                    "producteur_externe": "Une reception vient d'une cueillette ou "
                    "d'un producteur externe, pas des deux."
                }
            )
        if not cueillette and not externe:
            raise serializers.ValidationError(
                {
                    "cueillette": "Precisez l'origine : une cueillette ou un "
                    "producteur externe."
                }
            )
        if externe and externe.type_producteur != TypeProducteur.EXTERNE:
            raise serializers.ValidationError(
                {
                    "producteur_externe": "Ce producteur est interne : sa recolte "
                    "passe par une cueillette."
                }
            )

        recue = donnees.get("quantite_recue", getattr(self.instance, "quantite_recue", 0))
        bonne = donnees.get("quantite_bonne", getattr(self.instance, "quantite_bonne", 0))
        if bonne > recue:
            raise serializers.ValidationError(
                {"quantite_bonne": "La quantite bonne ne peut pas depasser le recu."}
            )
        return donnees


class ProductionSerializer(serializers.ModelSerializer):
    recette_libelle = serializers.CharField(source="get_recette_display", read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    controles_complets = serializers.BooleanField(read_only=True)

    class Meta:
        model = Production
        fields = [
            "id",
            "numero",
            "date_production",
            "lavage_effectue",
            "filtration_effectuee",
            "recette",
            "recette_libelle",
            "eau_ajoutee_l",
            "sucre_ajoute_kg",
            "sorbate_ajoute_g",
            "pasteurisation_80c",
            "test_qualite",
            "ph",
            "refractometre",
            "volume_final_l",
            "statut",
            "statut_libelle",
            "controles_complets",
            "agent_identifiant",
            "agent_nom",
        ]
        read_only_fields = ["numero", "agent_identifiant", "agent_nom"]

    def validate(self, donnees):
        """Une production ne se termine pas sans ses controles sanitaires.

        C'est cette ligne qu'on ressort en cas de reclamation sur un lot :
        la marquer terminee sans lavage ni pasteurisation la rendrait
        indefendable.
        """
        from jusorange.models import StatutProduction

        statut = donnees.get("statut", getattr(self.instance, "statut", None))
        if statut != StatutProduction.TERMINEE:
            return donnees

        def valeur(champ):
            return donnees.get(champ, getattr(self.instance, champ, False))

        manquants = [
            libelle
            for champ, libelle in (
                ("lavage_effectue", "lavage"),
                ("filtration_effectuee", "filtration"),
                ("pasteurisation_80c", "pasteurisation"),
            )
            if not valeur(champ)
        ]
        if manquants:
            raise serializers.ValidationError(
                {
                    "statut": "Controles sanitaires manquants : "
                    f"{', '.join(manquants)}."
                }
            )
        return donnees


class ConditionnementSerializer(serializers.ModelSerializer):
    production_numero = serializers.CharField(
        source="production.numero", read_only=True, default=""
    )
    bouteilles_produites = serializers.SerializerMethodField()

    class Meta:
        model = Conditionnement
        fields = [
            "id",
            "numero",
            "date_conditionnement",
            "quantite_33cl",
            "quantite_1l",
            "production",
            "production_numero",
            "bouteilles_produites",
            "agent_identifiant",
            "agent_nom",
        ]
        read_only_fields = ["numero", "agent_identifiant", "agent_nom"]

    def get_bouteilles_produites(self, conditionnement) -> int:
        return conditionnement.bouteilles.count()


class BouteilleSerializer(serializers.ModelSerializer):
    format_affiche = serializers.CharField(read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)

    class Meta:
        model = Bouteille
        fields = [
            "id",
            "conditionnement",
            "format_litre",
            "format_affiche",
            "code_barre",
            "date_limite",
            "statut",
            "statut_libelle",
            "commande",
        ]


class InventaireSerializer(serializers.ModelSerializer):
    article_libelle = serializers.CharField(
        source="article.get_type_article_display", read_only=True
    )
    qualite_libelle = serializers.CharField(source="get_qualite_display", read_only=True)

    class Meta:
        model = Inventaire
        fields = [
            "id",
            "article",
            "article_libelle",
            "date_inventaire",
            "quantite_systeme",
            "quantite_depot",
            "ecart",
            "statut",
            "qualite",
            "qualite_libelle",
            "observation",
            "agent_identifiant",
            "agent_nom",
        ]
        read_only_fields = ["ecart", "qualite", "agent_identifiant", "agent_nom"]


class ClientJusSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClientJus
        fields = ["id", "nom_complet", "telephone", "email", "adresse", "actif"]


class VenteSerializer(serializers.ModelSerializer):
    client_nom = serializers.CharField(source="client.nom_complet", read_only=True)
    mode_libelle = serializers.CharField(source="get_mode_display", read_only=True)
    montant_regle = serializers.FloatField(read_only=True)
    reste_a_payer = serializers.FloatField(read_only=True)

    class Meta:
        model = Vente
        fields = [
            "id",
            "client",
            "client_nom",
            "date_vente",
            "montant_total",
            "mode",
            "mode_libelle",
            "montant_regle",
            "reste_a_payer",
        ]


class CommandeSerializer(serializers.ModelSerializer):
    client_nom = serializers.CharField(source="client.nom_complet", read_only=True)

    class Meta:
        model = Commande
        fields = [
            "id",
            "client",
            "client_nom",
            "vente",
            "date_commande",
            "quantite_33cl",
            "quantite_1l",
            "observation",
        ]


class FactureSerializer(serializers.ModelSerializer):
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    montant_regle = serializers.FloatField(read_only=True)
    reste_a_payer = serializers.FloatField(read_only=True)

    class Meta:
        model = Facture
        fields = [
            "id",
            "numero",
            "vente",
            "date_facture",
            "montant",
            "statut",
            "statut_libelle",
            "date_echeance",
            "montant_regle",
            "reste_a_payer",
        ]
        # Le statut suit les paiements : le laisser saisir ferait disparaitre
        # des creances des relances.
        read_only_fields = ["numero", "statut"]


class PaiementSerializer(serializers.ModelSerializer):
    facture_numero = serializers.CharField(source="facture.numero", read_only=True)
    mode_libelle = serializers.CharField(source="get_mode_display", read_only=True)

    class Meta:
        model = Paiement
        fields = [
            "id",
            "facture",
            "facture_numero",
            "date_paiement",
            "montant",
            "mode",
            "mode_libelle",
            "reference",
        ]


class ReceptionPaiementSerializer(serializers.ModelSerializer):
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    ecart = serializers.FloatField(read_only=True)
    montant_declare = serializers.FloatField(source="paiement.montant", read_only=True)

    class Meta:
        model = ReceptionPaiement
        fields = [
            "id",
            "paiement",
            "montant_declare",
            "montant_recu",
            "ecart",
            "date_reception",
            "statut",
            "statut_libelle",
            "observation",
            "ecart_traite",
        ]
        read_only_fields = ["statut"]


class PointVenteSerializer(serializers.ModelSerializer):
    type_point_libelle = serializers.CharField(
        source="get_type_point_display", read_only=True
    )
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    derniere_visite = serializers.SerializerMethodField()

    class Meta:
        model = PointVente
        fields = [
            "id",
            "nom",
            "type_point",
            "type_point_libelle",
            "statut",
            "statut_libelle",
            "zone",
            "adresse",
            "contact",
            "telephone",
            "latitude",
            "longitude",
            "client",
            "derniere_visite",
        ]

    def get_derniere_visite(self, point):
        visite = point.visites.first()
        return visite.date_visite if visite else None


class VisiteSerializer(serializers.ModelSerializer):
    point_vente_nom = serializers.CharField(source="point_vente.nom", read_only=True)

    class Meta:
        model = Visite
        fields = [
            "id",
            "point_vente",
            "point_vente_nom",
            "commercial_identifiant",
            "commercial_nom",
            "date_visite",
            "statut_apres",
            "compte_rendu",
            "prochaine_visite",
        ]
        read_only_fields = ["commercial_identifiant", "commercial_nom"]
