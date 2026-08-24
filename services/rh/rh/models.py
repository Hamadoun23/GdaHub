"""Modeles du domaine Ressources humaines.

Origine du code repris : FinanceRH/backend/rh (Django 6 + DRF), en production
sur rh.gdamali.net.

Ce service ne tient pas l'annuaire : il le consomme. Un agent appartient a
`organisation` ; ici on ne garde que son identifiant de connexion et ce que
l'ecran affiche, fige au moment de l'enregistrement.

Le domaine couvre quatre choses, dans cet ordre d'importance :

1. **Les absences** — conges, permissions et retards. C'est le geste
   quotidien de l'application, et le seul qui passe par un circuit de
   validation.
2. **Les presences** — le pointage, alimente automatiquement par les absences
   approuvees.
3. **Les evaluations** — campagnes, criteres, notes ponderees.
4. **Les formations** — planning et inscriptions.

La permission d'absence est un objet distinct du conge, comme dans
l'application en production : elle n'entame pas le solde annuel et se demande
dans son propre ecran. Les melanger conduisait les agents a poser une journee
entiere pour une matinee d'absence.
"""

from datetime import timedelta
from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone
from gdahub_common.agents import ReferenceAgent
from gdahub_common.constantes import TypeDocument
from gdahub_common.validation.models import DocumentValidable, Horodate

# ---------------------------------------------------------------------------
# Conges, absences, retards et permissions
# ---------------------------------------------------------------------------


class CategorieAbsence(models.TextChoices):
    CONGE = "CONGE", "Conge"
    ABSENCE = "ABSENCE", "Absence"
    RETARD = "RETARD", "Retard"
    PERMISSION = "PERMISSION", "Permission"


class TypeAbsence(Horodate):
    """Ce qui distingue un conge annuel d'un retard : ses regles.

    Le type porte le decompte du solde, la duree maximale et l'exigence de
    justificatif. Un libelle saisi en clair par un agent cree un type inedit
    qui n'entame rien tant que les RH ne l'ont pas parametre : sur la foi d'un
    texte libre, on ne retire de jours a personne.
    """

    code = models.CharField("Code", max_length=16, unique=True)
    libelle = models.CharField("Libelle", max_length=120)
    categorie = models.CharField(
        "Categorie", max_length=12, choices=CategorieAbsence.choices
    )
    decompte_solde = models.BooleanField(
        "Deduit du solde annuel", default=True
    )
    duree_max_jours = models.PositiveSmallIntegerField(
        "Duree maximale (jours)", null=True, blank=True
    )
    justificatif_requis = models.BooleanField("Justificatif obligatoire", default=False)
    actif = models.BooleanField("Type actif", default=True)

    class Meta:
        db_table = "type_absence"
        ordering = ["categorie", "libelle"]
        verbose_name = "Type d'absence"
        verbose_name_plural = "Types d'absence"

    def __str__(self):
        return self.libelle


class SoldeConge(ReferenceAgent, Horodate):
    """Le compte de jours d'un agent pour une annee."""

    annee = models.PositiveIntegerField("Annee")
    jours_acquis = models.DecimalField(
        "Jours acquis", max_digits=5, decimal_places=1, default=Decimal("30.0")
    )
    jours_reportes = models.DecimalField(
        "Jours reportes", max_digits=5, decimal_places=1, default=Decimal("0.0")
    )
    jours_pris = models.DecimalField(
        "Jours pris", max_digits=5, decimal_places=1, default=Decimal("0.0")
    )

    class Meta:
        db_table = "solde_conge"
        constraints = [
            models.UniqueConstraint(
                fields=["agent_identifiant", "annee"], name="un_solde_par_agent_et_annee"
            )
        ]
        ordering = ["-annee", "agent_nom"]
        verbose_name = "Solde de conges"
        verbose_name_plural = "Soldes de conges"

    def __str__(self):
        return f"{self.agent_nom} - {self.annee} : {self.jours_restants} j"

    @property
    def jours_restants(self) -> Decimal:
        return self.jours_acquis + self.jours_reportes - self.jours_pris


class DemandeAbsence(DocumentValidable):
    """Demande de conge, d'absence, de retard ou de permission.

    Passe par le circuit de validation commun a tout l'ERP, avec les regles
    configurees pour le type de document `ABSENCE`.
    """

    PREFIXE_NUMERO = "ABS"
    TYPE_DOCUMENT = TypeDocument.ABSENCE

    type_absence = models.ForeignKey(
        TypeAbsence,
        on_delete=models.PROTECT,
        related_name="demandes",
        verbose_name="Type",
    )
    date_debut = models.DateField("Du")
    date_fin = models.DateField("Au")
    demi_journee = models.BooleanField(
        "Demi-journee", default=False, help_text="Absence d'une demi-journee seulement."
    )
    heure_debut = models.TimeField(
        "Heure de debut",
        null=True,
        blank=True,
        help_text="Pour les retards et les permissions horaires.",
    )
    heure_fin = models.TimeField("Heure de fin", null=True, blank=True)
    nb_jours = models.DecimalField(
        "Nombre de jours", max_digits=5, decimal_places=1, default=Decimal("0.0")
    )
    motif = models.TextField("Motif")
    justificatif = models.FileField(
        "Justificatif", upload_to="justificatifs/absences/", null=True, blank=True
    )
    remplacant_identifiant = models.CharField(
        "Remplacant", max_length=150, blank=True
    )
    remplacant_nom = models.CharField("Nom du remplacant", max_length=150, blank=True)

    class Meta(DocumentValidable.Meta):
        db_table = "demande_absence"
        verbose_name = "Demande d'absence"
        verbose_name_plural = "Demandes d'absence"

    @property
    def categorie(self) -> str:
        return self.type_absence.categorie

    def calculer_nb_jours(self) -> Decimal:
        if self.demi_journee:
            return Decimal("0.5")
        jours = (self.date_fin - self.date_debut).days + 1
        return Decimal(max(jours, 0))

    def save(self, *args, **kwargs):
        self.nb_jours = self.calculer_nb_jours()
        super().save(*args, **kwargs)

    def apres_approbation(self):
        """Repercute l'absence approuvee sur le solde et sur les presences.

        C'est le seul endroit de l'ERP ou un solde bouge tout seul : un jour
        n'est decompte qu'au terme du circuit, jamais au depot. Une demande
        rejetee ou annulee ne coute donc rien a personne.
        """
        from rh.services import decompter_solde, marquer_presences

        if self.type_absence.decompte_solde:
            decompter_solde(self)
        marquer_presences(self)


# ---------------------------------------------------------------------------
# Suivi des presences
# ---------------------------------------------------------------------------


class StatutPresence(models.TextChoices):
    PRESENT = "PRESENT", "Present"
    RETARD = "RETARD", "En retard"
    ABSENT = "ABSENT", "Absent"
    CONGE = "CONGE", "En conge"
    MISSION = "MISSION", "En mission"
    TELETRAVAIL = "TELETRAVAIL", "Teletravail"
    REPOS = "REPOS", "Repos / ferie"


class Presence(ReferenceAgent, Horodate):
    """Le pointage d'un agent pour une journee."""

    HEURE_REFERENCE_ARRIVEE = "08:00"

    date = models.DateField("Date", default=timezone.localdate)
    heure_arrivee = models.TimeField("Arrivee", null=True, blank=True)
    heure_depart = models.TimeField("Depart", null=True, blank=True)
    statut = models.CharField(
        "Statut",
        max_length=12,
        choices=StatutPresence.choices,
        default=StatutPresence.PRESENT,
    )
    retard_minutes = models.PositiveIntegerField("Retard (minutes)", default=0)
    commentaire = models.CharField("Commentaire", max_length=255, blank=True)
    saisi_par_identifiant = models.CharField("Saisi par", max_length=150, blank=True)

    class Meta:
        db_table = "presence"
        constraints = [
            models.UniqueConstraint(
                fields=["agent_identifiant", "date"], name="un_pointage_par_agent_et_jour"
            )
        ]
        ordering = ["-date", "agent_nom"]
        verbose_name = "Presence"
        verbose_name_plural = "Presences"

    def __str__(self):
        return f"{self.agent_nom} - {self.date} ({self.get_statut_display()})"

    @property
    def heures_travaillees(self) -> Decimal:
        if not (self.heure_arrivee and self.heure_depart):
            return Decimal("0.0")
        debut = timedelta(
            hours=self.heure_arrivee.hour, minutes=self.heure_arrivee.minute
        )
        fin = timedelta(hours=self.heure_depart.hour, minutes=self.heure_depart.minute)
        heures = (fin - debut).total_seconds() / 3600
        return Decimal(str(round(max(heures, 0), 2)))


# ---------------------------------------------------------------------------
# Evaluations et performance
# ---------------------------------------------------------------------------


class StatutCampagne(models.TextChoices):
    PREPARATION = "PREPARATION", "En preparation"
    OUVERTE = "OUVERTE", "Ouverte"
    CLOTUREE = "CLOTUREE", "Cloturee"


class CampagneEvaluation(Horodate):
    libelle = models.CharField("Libelle", max_length=150)
    periode_debut = models.DateField("Debut de periode")
    periode_fin = models.DateField("Fin de periode")
    date_limite = models.DateField("Date limite", null=True, blank=True)
    statut = models.CharField(
        "Statut",
        max_length=12,
        choices=StatutCampagne.choices,
        default=StatutCampagne.PREPARATION,
    )
    consignes = models.TextField("Consignes", blank=True)

    class Meta:
        db_table = "campagne_evaluation"
        ordering = ["-periode_debut"]
        verbose_name = "Campagne d'evaluation"
        verbose_name_plural = "Campagnes d'evaluation"

    def __str__(self):
        return self.libelle


class CritereEvaluation(Horodate):
    campagne = models.ForeignKey(
        CampagneEvaluation, on_delete=models.CASCADE, related_name="criteres"
    )
    libelle = models.CharField("Libelle", max_length=150)
    description = models.TextField("Description", blank=True)
    poids = models.PositiveSmallIntegerField(
        "Poids",
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(10)],
    )

    class Meta:
        db_table = "critere_evaluation"
        ordering = ["id"]
        verbose_name = "Critere d'evaluation"
        verbose_name_plural = "Criteres d'evaluation"

    def __str__(self):
        return self.libelle


class StatutEvaluation(models.TextChoices):
    A_FAIRE = "A_FAIRE", "A faire"
    AUTO_EVALUATION = "AUTO_EVALUATION", "Auto-evaluation en cours"
    EVALUEE = "EVALUEE", "Evaluee par le responsable"
    VALIDEE = "VALIDEE", "Validee RH"


class Evaluation(ReferenceAgent, Horodate):
    campagne = models.ForeignKey(
        CampagneEvaluation, on_delete=models.CASCADE, related_name="evaluations"
    )
    evaluateur_identifiant = models.CharField(
        "Evaluateur", max_length=150, blank=True
    )
    evaluateur_nom = models.CharField("Nom de l'evaluateur", max_length=150, blank=True)
    statut = models.CharField(
        "Statut",
        max_length=16,
        choices=StatutEvaluation.choices,
        default=StatutEvaluation.A_FAIRE,
    )
    note_globale = models.DecimalField(
        "Note globale",
        max_digits=4,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Note ponderee sur 5, calculee a partir des criteres.",
    )
    points_forts = models.TextField("Points forts", blank=True)
    axes_amelioration = models.TextField("Axes d'amelioration", blank=True)
    objectifs = models.TextField("Objectifs", blank=True)
    commentaire_agent = models.TextField("Commentaire de l'agent", blank=True)
    date_entretien = models.DateField("Date de l'entretien", null=True, blank=True)

    class Meta:
        db_table = "evaluation"
        constraints = [
            models.UniqueConstraint(
                fields=["campagne", "agent_identifiant"],
                name="une_evaluation_par_agent_et_campagne",
            )
        ]
        ordering = ["-campagne__periode_debut", "agent_nom"]
        verbose_name = "Evaluation"
        verbose_name_plural = "Evaluations"

    def __str__(self):
        return f"{self.agent_nom} - {self.campagne}"

    def recalculer_note(self):
        """La note globale est la moyenne des criteres, ponderee par leur poids."""
        notes = list(self.notes.select_related("critere"))
        total_poids = sum(note.critere.poids for note in notes)
        if not total_poids:
            self.note_globale = None
        else:
            pondere = sum(Decimal(note.note) * note.critere.poids for note in notes)
            self.note_globale = (pondere / total_poids).quantize(Decimal("0.01"))
        self.save(update_fields=["note_globale", "modifie_le"])
        return self.note_globale


class NoteCritere(Horodate):
    evaluation = models.ForeignKey(
        Evaluation, on_delete=models.CASCADE, related_name="notes"
    )
    critere = models.ForeignKey(
        CritereEvaluation, on_delete=models.CASCADE, related_name="notes"
    )
    note = models.DecimalField(
        "Note",
        max_digits=3,
        decimal_places=1,
        validators=[MinValueValidator(0), MaxValueValidator(5)],
        help_text="Note de 0 a 5.",
    )
    commentaire = models.TextField("Commentaire", blank=True)

    class Meta:
        db_table = "note_critere"
        constraints = [
            models.UniqueConstraint(
                fields=["evaluation", "critere"], name="une_note_par_critere"
            )
        ]
        ordering = ["critere_id"]
        verbose_name = "Note par critere"
        verbose_name_plural = "Notes par critere"

    def __str__(self):
        return f"{self.critere} : {self.note}/5"


# ---------------------------------------------------------------------------
# Planning des formations
# ---------------------------------------------------------------------------


class StatutFormation(models.TextChoices):
    PLANIFIEE = "PLANIFIEE", "Planifiee"
    EN_COURS = "EN_COURS", "En cours"
    TERMINEE = "TERMINEE", "Terminee"
    ANNULEE = "ANNULEE", "Annulee"


class Formation(Horodate):
    titre = models.CharField("Titre", max_length=180)
    categorie = models.CharField("Categorie", max_length=80, blank=True)
    description = models.TextField("Description", blank=True)
    formateur = models.CharField("Formateur", max_length=150, blank=True)
    organisme = models.CharField("Organisme", max_length=150, blank=True)
    lieu = models.CharField("Lieu", max_length=150, blank=True)
    date_debut = models.DateField("Debut")
    date_fin = models.DateField("Fin")
    places = models.PositiveSmallIntegerField("Places", default=20)
    obligatoire = models.BooleanField("Formation obligatoire", default=False)
    #: Les departements vises, par leurs numeros dans l'annuaire. Une liste
    #: plutot qu'une relation : les departements appartiennent a
    #: `organisation`, et une cle etrangere ne traverse pas les bases.
    departements_cibles = models.JSONField(
        "Departements cibles", default=list, blank=True
    )
    statut = models.CharField(
        "Statut",
        max_length=12,
        choices=StatutFormation.choices,
        default=StatutFormation.PLANIFIEE,
    )

    class Meta:
        db_table = "formation"
        ordering = ["date_debut"]
        verbose_name = "Formation"
        verbose_name_plural = "Formations"

    def __str__(self):
        return self.titre

    @property
    def places_restantes(self) -> int:
        prises = self.inscriptions.exclude(statut=StatutInscription.REFUSE).count()
        return max(self.places - prises, 0)


class StatutInscription(models.TextChoices):
    DEMANDE = "DEMANDE", "Demande"
    CONFIRME = "CONFIRME", "Confirmee"
    REFUSE = "REFUSE", "Refusee"
    PRESENT = "PRESENT", "Presence confirmee"
    ABSENT = "ABSENT", "Absent"


class InscriptionFormation(ReferenceAgent, Horodate):
    formation = models.ForeignKey(
        Formation, on_delete=models.CASCADE, related_name="inscriptions"
    )
    statut = models.CharField(
        "Statut",
        max_length=10,
        choices=StatutInscription.choices,
        default=StatutInscription.DEMANDE,
    )
    note_satisfaction = models.PositiveSmallIntegerField(
        "Satisfaction",
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    commentaire = models.TextField("Commentaire", blank=True)

    class Meta:
        db_table = "inscription_formation"
        constraints = [
            models.UniqueConstraint(
                fields=["formation", "agent_identifiant"],
                name="une_inscription_par_agent_et_formation",
            )
        ]
        ordering = ["-cree_le"]
        verbose_name = "Inscription a une formation"
        verbose_name_plural = "Inscriptions aux formations"

    def __str__(self):
        return f"{self.agent_nom} -> {self.formation}"
