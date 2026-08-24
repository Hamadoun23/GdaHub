"""Representations JSON du domaine Chantiers."""

from rest_framework import serializers

from chantiers.models import (
    AffectationProjet,
    JournalActivite,
    MiseAJourJournaliere,
    NoteAvancement,
    Phase,
    Photo,
    Projet,
    RapportJournalier,
    SousPhase,
    Tache,
)


class MiseAJourJournaliereSerializer(serializers.ModelSerializer):
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)

    class Meta:
        model = MiseAJourJournaliere
        fields = [
            "id",
            "tache",
            "date_rapport",
            "avancement",
            "statut",
            "statut_libelle",
            "commentaire",
            "agent_identifiant",
            "agent_nom",
            "cree_le",
        ]
        # Le statut se deduit de l'avancement ; qui saisit vient du jeton.
        read_only_fields = ["statut", "agent_identifiant", "agent_nom"]


class NoteAvancementSerializer(serializers.ModelSerializer):
    class Meta:
        model = NoteAvancement
        fields = [
            "id",
            "tache",
            "mise_a_jour",
            "avancement",
            "avancement_precedent",
            "corps",
            "agent_identifiant",
            "agent_nom",
            "cree_le",
        ]
        read_only_fields = [
            "avancement_precedent",
            "agent_identifiant",
            "agent_nom",
        ]


class TacheSerializer(serializers.ModelSerializer):
    avancement = serializers.SerializerMethodField()
    derniere_saisie = serializers.SerializerMethodField()
    phase_nom = serializers.CharField(source="sous_phase.phase.nom", read_only=True)
    sous_phase_nom = serializers.CharField(source="sous_phase.nom", read_only=True)

    class Meta:
        model = Tache
        fields = [
            "id",
            "sous_phase",
            "sous_phase_nom",
            "phase_nom",
            "activite",
            "jour_debut",
            "duree_jours",
            "ordre",
            "masquee_partenaire",
            "avancement",
            "derniere_saisie",
        ]

    def get_avancement(self, tache) -> int:
        return tache.avancement()

    def get_derniere_saisie(self, tache):
        derniere = tache.derniere_mise_a_jour()
        return derniere.date_rapport if derniere else None


class SousPhaseSerializer(serializers.ModelSerializer):
    taches = TacheSerializer(many=True, read_only=True)
    avancement = serializers.SerializerMethodField()

    class Meta:
        model = SousPhase
        fields = [
            "id",
            "phase",
            "nom",
            "ordre",
            "masquee_partenaire",
            "avancement",
            "taches",
        ]

    def get_avancement(self, sous_phase) -> int:
        return sous_phase.avancement()


class PhaseSerializer(serializers.ModelSerializer):
    sous_phases = SousPhaseSerializer(many=True, read_only=True)
    avancement = serializers.SerializerMethodField()

    class Meta:
        model = Phase
        fields = [
            "id",
            "projet",
            "nom",
            "ordre",
            "masquee_partenaire",
            "avancement",
            "sous_phases",
        ]

    def get_avancement(self, phase) -> int:
        return phase.avancement()


class AffectationProjetSerializer(serializers.ModelSerializer):
    class Meta:
        model = AffectationProjet
        fields = [
            "id",
            "projet",
            "agent_identifiant",
            "agent_nom",
            "affecte_par",
        ]
        read_only_fields = ["affecte_par"]


class ProjetSerializer(serializers.ModelSerializer):
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    avancement = serializers.SerializerMethodField()
    nombre_de_taches = serializers.SerializerMethodField()
    affectations = AffectationProjetSerializer(many=True, read_only=True)

    class Meta:
        model = Projet
        fields = [
            "id",
            "nom",
            "description",
            "client",
            "date_debut",
            "date_fin",
            "statut",
            "statut_libelle",
            "ordre",
            "affectations",
            "avancement",
            "nombre_de_taches",
            "cree_le",
        ]

    def get_avancement(self, projet) -> int:
        return projet.avancement()

    def get_nombre_de_taches(self, projet) -> int:
        return projet.nombre_de_taches()

    def validate(self, donnees):
        debut = donnees.get("date_debut", getattr(self.instance, "date_debut", None))
        fin = donnees.get("date_fin", getattr(self.instance, "date_fin", None))
        if debut and fin and fin < debut:
            raise serializers.ValidationError(
                {"date_fin": "La fin du chantier doit suivre son debut."}
            )
        return donnees


class ProjetDetailSerializer(ProjetSerializer):
    """Le chantier avec toute sa hierarchie, pour l'ecran de suivi."""

    phases = serializers.SerializerMethodField()
    avancement_par_phase = serializers.SerializerMethodField()

    class Meta(ProjetSerializer.Meta):
        fields = [*ProjetSerializer.Meta.fields, "phases", "avancement_par_phase"]

    def get_phases(self, projet):
        # Le masquage partenaire se decide ici, une fois, plutot que dans
        # chaque serializer imbrique : une regle de confidentialite doit se
        # lire d'un seul endroit.
        masquer = self.context.get("masquer_partenaire", False)
        phases = projet.phases.prefetch_related("sous_phases__taches")
        if masquer:
            phases = phases.filter(masquee_partenaire=False)
        donnees = []
        for phase in phases:
            bloc = PhaseSerializer(phase, context=self.context).data
            if masquer:
                bloc["sous_phases"] = [
                    {
                        **sous_phase,
                        "taches": [
                            tache
                            for tache in sous_phase["taches"]
                            if not tache["masquee_partenaire"]
                        ],
                    }
                    for sous_phase in bloc["sous_phases"]
                    if not sous_phase["masquee_partenaire"]
                ]
            donnees.append(bloc)
        return donnees

    def get_avancement_par_phase(self, projet) -> dict:
        return projet.avancement_par_phase()


class PhotoSerializer(serializers.ModelSerializer):
    categorie_libelle = serializers.CharField(
        source="get_categorie_display", read_only=True
    )

    class Meta:
        model = Photo
        fields = [
            "id",
            "projet",
            "categorie",
            "categorie_libelle",
            "fichier",
            "nom_origine",
            "legende",
            "prise_le",
            "taille",
            "agent_identifiant",
            "agent_nom",
            "cree_le",
        ]
        read_only_fields = ["taille", "agent_identifiant", "agent_nom"]


class RapportJournalierSerializer(serializers.ModelSerializer):
    projet_nom = serializers.CharField(source="projet.nom", read_only=True)

    class Meta:
        model = RapportJournalier
        fields = [
            "id",
            "projet",
            "projet_nom",
            "date_rapport",
            "temperature",
            "meteo",
            "avancement_global",
            "notes",
            "agent_identifiant",
            "agent_nom",
            "cree_le",
        ]
        # L'avancement global est celui du chantier au moment du rapport : le
        # laisser saisir permettrait d'ecrire autre chose que la realite.
        read_only_fields = ["avancement_global", "agent_identifiant", "agent_nom"]


class JournalActiviteSerializer(serializers.ModelSerializer):
    class Meta:
        model = JournalActivite
        fields = [
            "id",
            "agent_identifiant",
            "agent_nom",
            "action",
            "objet_type",
            "objet_id",
            "projet_id",
            "description",
            "details",
            "cree_le",
        ]
        read_only_fields = fields
