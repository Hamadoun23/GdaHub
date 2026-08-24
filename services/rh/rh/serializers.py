"""Representations JSON du domaine Ressources humaines."""

from rest_framework import serializers

from gdahub_common.validation.serializers import DocumentValidableSerializer
from rh import services
from rh.models import (
    CampagneEvaluation,
    CritereEvaluation,
    DemandeAbsence,
    Evaluation,
    Formation,
    InscriptionFormation,
    NoteCritere,
    Presence,
    SoldeConge,
    TypeAbsence,
)


class TypeAbsenceSerializer(serializers.ModelSerializer):
    categorie_libelle = serializers.CharField(
        source="get_categorie_display", read_only=True
    )

    class Meta:
        model = TypeAbsence
        fields = [
            "id",
            "code",
            "libelle",
            "categorie",
            "categorie_libelle",
            "decompte_solde",
            "duree_max_jours",
            "justificatif_requis",
            "actif",
        ]


class SoldeCongeSerializer(serializers.ModelSerializer):
    jours_restants = serializers.DecimalField(
        max_digits=5, decimal_places=1, read_only=True
    )

    class Meta:
        model = SoldeConge
        fields = [
            "id",
            "agent_identifiant",
            "agent_nom",
            "agent_departement_nom",
            "annee",
            "jours_acquis",
            "jours_reportes",
            "jours_pris",
            "jours_restants",
        ]
        read_only_fields = ["agent_identifiant", "agent_nom", "agent_departement_nom"]


class DemandeAbsenceSerializer(DocumentValidableSerializer):
    """Le demandeur saisit son type en clair plutot que de le choisir.

    Un libelle deja connu est reutilise, insensiblement a la casse ; un libelle
    inedit cree un type que les RH auront a arbitrer. La cle etrangere reste
    derriere : c'est elle qui porte le decompte du solde, la duree maximale et
    l'exigence de justificatif.
    """

    type_absence = serializers.CharField(max_length=120)
    type_absence_libelle = serializers.CharField(
        source="type_absence.libelle", read_only=True
    )
    categorie = serializers.CharField(source="type_absence.categorie", read_only=True)

    class Meta:
        model = DemandeAbsence
        fields = [
            "id",
            "type_absence",
            "type_absence_libelle",
            "categorie",
            "date_debut",
            "date_fin",
            "demi_journee",
            "heure_debut",
            "heure_fin",
            "nb_jours",
            "motif",
            "justificatif",
            "remplacant_identifiant",
            "remplacant_nom",
            *DocumentValidableSerializer.CHAMPS_DEMANDEUR,
            *DocumentValidableSerializer.CHAMPS_CIRCUIT,
        ]
        read_only_fields = [
            "nb_jours",
            *DocumentValidableSerializer.CHAMPS_DEMANDEUR,
            *DocumentValidableSerializer.CHAMPS_CIRCUIT,
        ]

    def validate_type_absence(self, valeur):
        type_absence = services.type_par_libelle(valeur)
        if not type_absence:
            raise serializers.ValidationError("Precisez le type d'absence.")
        return type_absence

    def validate(self, donnees):
        debut = donnees.get("date_debut", getattr(self.instance, "date_debut", None))
        fin = donnees.get("date_fin", getattr(self.instance, "date_fin", None))
        if debut and fin and fin < debut:
            raise serializers.ValidationError(
                {"date_fin": "La date de fin doit suivre la date de debut."}
            )

        type_absence = donnees.get(
            "type_absence", getattr(self.instance, "type_absence", None)
        )
        # Un libelle inedit est encore une chaine : il ne porte aucune regle,
        # il n'y a donc ni duree maximale ni justificatif a controler.
        if not isinstance(type_absence, TypeAbsence):
            return donnees

        if type_absence.duree_max_jours and debut and fin:
            duree = (fin - debut).days + 1
            if duree > type_absence.duree_max_jours:
                raise serializers.ValidationError(
                    {
                        "date_fin": f"Duree maximale pour ce type : "
                        f"{type_absence.duree_max_jours} jours (demande : {duree})."
                    }
                )
        if type_absence.justificatif_requis:
            justificatif = donnees.get(
                "justificatif", getattr(self.instance, "justificatif", None)
            )
            if not justificatif:
                raise serializers.ValidationError(
                    {
                        "justificatif": "Un justificatif est obligatoire pour ce "
                        "type d'absence."
                    }
                )
        return donnees

    def create(self, donnees):
        donnees["type_absence"] = services.materialiser_type(donnees["type_absence"])
        return super().create(donnees)

    def update(self, instance, donnees):
        if "type_absence" in donnees:
            donnees["type_absence"] = services.materialiser_type(donnees["type_absence"])
        return super().update(instance, donnees)


class PresenceSerializer(serializers.ModelSerializer):
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    heures_travaillees = serializers.DecimalField(
        max_digits=5, decimal_places=2, read_only=True
    )

    class Meta:
        model = Presence
        fields = [
            "id",
            "agent_identifiant",
            "agent_nom",
            "agent_departement_id",
            "agent_departement_nom",
            "date",
            "heure_arrivee",
            "heure_depart",
            "statut",
            "statut_libelle",
            "retard_minutes",
            "heures_travaillees",
            "commentaire",
            "saisi_par_identifiant",
        ]
        read_only_fields = ["saisi_par_identifiant"]


class CritereEvaluationSerializer(serializers.ModelSerializer):
    class Meta:
        model = CritereEvaluation
        fields = ["id", "campagne", "libelle", "description", "poids"]


class CampagneEvaluationSerializer(serializers.ModelSerializer):
    criteres = CritereEvaluationSerializer(many=True, read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)

    class Meta:
        model = CampagneEvaluation
        fields = [
            "id",
            "libelle",
            "periode_debut",
            "periode_fin",
            "date_limite",
            "statut",
            "statut_libelle",
            "consignes",
            "criteres",
        ]

    def validate(self, donnees):
        debut = donnees.get("periode_debut", getattr(self.instance, "periode_debut", None))
        fin = donnees.get("periode_fin", getattr(self.instance, "periode_fin", None))
        if debut and fin and fin < debut:
            raise serializers.ValidationError(
                {"periode_fin": "La fin de periode doit suivre le debut."}
            )
        return donnees


class NoteCritereSerializer(serializers.ModelSerializer):
    critere_libelle = serializers.CharField(source="critere.libelle", read_only=True)
    poids = serializers.IntegerField(source="critere.poids", read_only=True)

    class Meta:
        model = NoteCritere
        fields = ["id", "evaluation", "critere", "critere_libelle", "poids", "note", "commentaire"]


class EvaluationSerializer(serializers.ModelSerializer):
    notes = NoteCritereSerializer(many=True, read_only=True)
    campagne_libelle = serializers.CharField(source="campagne.libelle", read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)

    class Meta:
        model = Evaluation
        fields = [
            "id",
            "campagne",
            "campagne_libelle",
            "agent_identifiant",
            "agent_nom",
            "agent_departement_nom",
            "evaluateur_identifiant",
            "evaluateur_nom",
            "statut",
            "statut_libelle",
            "note_globale",
            "points_forts",
            "axes_amelioration",
            "objectifs",
            "commentaire_agent",
            "date_entretien",
            "notes",
        ]
        read_only_fields = ["note_globale"]


class InscriptionFormationSerializer(serializers.ModelSerializer):
    formation_titre = serializers.CharField(source="formation.titre", read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)

    class Meta:
        model = InscriptionFormation
        fields = [
            "id",
            "formation",
            "formation_titre",
            "agent_identifiant",
            "agent_nom",
            "statut",
            "statut_libelle",
            "note_satisfaction",
            "commentaire",
        ]
        read_only_fields = ["agent_identifiant", "agent_nom"]


class FormationSerializer(serializers.ModelSerializer):
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    places_restantes = serializers.IntegerField(read_only=True)
    inscrits = serializers.SerializerMethodField()

    class Meta:
        model = Formation
        fields = [
            "id",
            "titre",
            "categorie",
            "description",
            "formateur",
            "organisme",
            "lieu",
            "date_debut",
            "date_fin",
            "places",
            "places_restantes",
            "obligatoire",
            "departements_cibles",
            "statut",
            "statut_libelle",
            "inscrits",
        ]

    def get_inscrits(self, formation) -> int:
        return formation.inscriptions.count()

    def validate(self, donnees):
        debut = donnees.get("date_debut", getattr(self.instance, "date_debut", None))
        fin = donnees.get("date_fin", getattr(self.instance, "date_fin", None))
        if debut and fin and fin < debut:
            raise serializers.ValidationError(
                {"date_fin": "La fin doit suivre le debut."}
            )
        return donnees
