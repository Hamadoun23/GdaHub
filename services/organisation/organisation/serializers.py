"""Representations JSON du domaine Organisation."""

from rest_framework import serializers

from organisation.models import Agent, Departement


class AgentResumeSerializer(serializers.ModelSerializer):
    """La forme courte, celle que les autres ecrans affichent.

    C'est aussi ce que les autres services recopient chez eux : garder les
    deux representations alignees evite qu'un instantane contienne un champ
    que l'annuaire n'expose plus.
    """

    nom_complet = serializers.CharField(read_only=True)
    departement_nom = serializers.CharField(
        source="departement.nom", read_only=True, default=""
    )

    class Meta:
        model = Agent
        fields = ["id", "matricule", "nom_complet", "poste", "departement_nom"]


class DepartementSerializer(serializers.ModelSerializer):
    effectif = serializers.IntegerField(read_only=True)
    responsable_nom = serializers.CharField(
        source="responsable.nom_complet", read_only=True, default=""
    )

    class Meta:
        model = Departement
        fields = [
            "id",
            "code",
            "nom",
            "responsable",
            "responsable_nom",
            "effectif",
            "actif",
        ]


class AgentSerializer(serializers.ModelSerializer):
    nom_complet = serializers.CharField(read_only=True)
    departement_nom = serializers.CharField(
        source="departement.nom", read_only=True, default=""
    )
    responsable_nom = serializers.CharField(
        source="responsable.nom_complet", read_only=True, default=""
    )
    type_contrat_libelle = serializers.CharField(
        source="get_type_contrat_display", read_only=True
    )
    anciennete_mois = serializers.IntegerField(read_only=True)
    est_encadrant = serializers.BooleanField(read_only=True)
    a_un_compte = serializers.SerializerMethodField()

    class Meta:
        model = Agent
        fields = [
            "id",
            "identifiant",
            "matricule",
            "prenom",
            "nom",
            "nom_complet",
            "email",
            "telephone",
            "poste",
            "departement",
            "departement_nom",
            "responsable",
            "responsable_nom",
            "type_contrat",
            "type_contrat_libelle",
            "date_embauche",
            "date_sortie",
            "motif_sortie",
            "anciennete_mois",
            "est_encadrant",
            "a_un_compte",
            "actif",
        ]
        # Le matricule s'attribue tout seul a la creation ; le compte se
        # rattache a la premiere connexion de l'interesse, jamais a la main.
        read_only_fields = ["matricule"]

    def get_a_un_compte(self, agent) -> bool:
        return agent.compte_id is not None

    def validate_identifiant(self, valeur):
        return valeur.strip().lower()

    def validate(self, donnees):
        """Un agent ne peut pas etre son propre responsable.

        Le cas parait absurde jusqu'a ce qu'une liste deroulante de deux cents
        noms le rende possible d'un clic — et une demande dont le valideur est
        le demandeur ne circule plus.
        """
        responsable = donnees.get("responsable")
        if (
            responsable is not None
            and self.instance is not None
            and responsable.pk == self.instance.pk
        ):
            raise serializers.ValidationError(
                {"responsable": "Un agent ne peut pas etre son propre responsable."}
            )

        debut = donnees.get(
            "date_embauche", getattr(self.instance, "date_embauche", None)
        )
        fin = donnees.get("date_sortie", getattr(self.instance, "date_sortie", None))
        if debut and fin and fin < debut:
            raise serializers.ValidationError(
                {"date_sortie": "La sortie ne peut pas preceder l'embauche."}
            )
        return donnees


class FicheSerializer(AgentSerializer):
    """« Ma fiche » : l'agent corrige ses coordonnees, rien d'autre.

    Poste, departement et rattachement pilotent les circuits de validation :
    les laisser modifiables par l'interesse reviendrait a le laisser choisir
    qui valide ses demandes.
    """

    class Meta(AgentSerializer.Meta):
        read_only_fields = [
            "matricule",
            "identifiant",
            "poste",
            "departement",
            "responsable",
            "type_contrat",
            "date_embauche",
            "date_sortie",
            "motif_sortie",
            "actif",
        ]
