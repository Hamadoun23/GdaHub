"""Modeles du domaine Chantiers.

Origine du code repris : `ERP-GDA-Aba-4-module-/backend/apps/chantiers`, lui-meme
porte de l'application Laravel DailyGDA.

La hierarchie est celle de l'application d'origine, et elle a une raison :

    Projet -> Phase -> Sous-phase -> Tache -> mise a jour journaliere

Une tache ne porte pas son avancement : elle porte l'historique de ses
avancements, un par jour. C'est ce qui permet de dire « ou en etait le
chantier le 12 mars » et non seulement « ou en est-il aujourd'hui ». Un
pourcentage stocke sur la tache aurait ete plus simple et aurait rendu le
rapport journalier impossible.

**Correspondance avec le schema d'origine**, pour la reprise des donnees :

| Ici | DailyGDA / Laravel |
| --- | --- |
| `Projet.nom` | `projects.name` |
| `Phase.ordre` | `phases.sort_order` |
| `Tache.activite` | `tasks.activity` |
| `MiseAJourJournaliere.date_rapport` | `daily_updates.report_date` |
| `Tache.masquee_partenaire` | `tasks.hidden_from_partner` |

Le masquage partenaire traverse toute la hierarchie : un partenaire exterieur
voit le chantier sans en voir les lignes que GDA garde pour elle. C'est une
regle de confidentialite, pas un confort d'affichage.
"""

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import OuterRef, Subquery
from gdahub_common.validation.models import Horodate


class StatutProjet(models.TextChoices):
    PLANIFIE = "PLANIFIE", "Planifie"
    EN_COURS = "EN_COURS", "En cours"
    TERMINE = "TERMINE", "Termine"
    SUSPENDU = "SUSPENDU", "Suspendu"


class StatutTache(models.TextChoices):
    NON_DEMARRE = "NON_DEMARRE", "Non demarre"
    EN_COURS = "EN_COURS", "En cours"
    TERMINE = "TERMINE", "Termine"
    ANNULE = "ANNULE", "Annule"


class Projet(Horodate):
    """Un chantier."""

    nom = models.CharField("Nom", max_length=255)
    description = models.TextField("Description", blank=True)
    client = models.CharField("Client", max_length=255, blank=True)
    date_debut = models.DateField("Debut", null=True, blank=True)
    date_fin = models.DateField("Fin", null=True, blank=True)
    statut = models.CharField(
        "Statut",
        max_length=12,
        choices=StatutProjet.choices,
        default=StatutProjet.PLANIFIE,
    )
    ordre = models.IntegerField("Ordre d'affichage", default=0)

    class Meta:
        db_table = "projet"
        ordering = ["ordre", "id"]
        verbose_name = "Projet"
        verbose_name_plural = "Projets"

    def __str__(self):
        return self.nom

    def avancement(self) -> int:
        """La moyenne des derniers avancements connus, tache par tache.

        Une seule requete quelle que soit la taille du chantier : la version
        d'origine interrogeait la base une fois par tache, ce qui rendait le
        tableau de bord de plus en plus lent a mesure que le projet avancait.
        """
        return avancement_moyen(Tache.objects.filter(sous_phase__phase__projet=self))

    def avancement_par_phase(self) -> dict[str, int]:
        return {
            phase.nom: phase.avancement() for phase in self.phases.order_by("ordre")
        }

    def nombre_de_taches(self) -> int:
        return Tache.objects.filter(sous_phase__phase__projet=self).count()

    def identifiants_affectes(self) -> list[str]:
        return list(self.affectations.values_list("agent_identifiant", flat=True))


class AffectationProjet(Horodate):
    """Qui travaille sur ce chantier.

    Une table plutot qu'une liste dans un champ JSON : le filtrage « les
    chantiers de cette personne » s'ecrit alors avec une jointure indexee, et
    non avec un `contains` qui ne fonctionne que sur PostgreSQL et ne se teste
    nulle part ailleurs.

    L'agent appartient a `organisation` : on ne garde que son identifiant de
    connexion et le nom que l'ecran affiche.
    """

    projet = models.ForeignKey(
        Projet, on_delete=models.CASCADE, related_name="affectations"
    )
    agent_identifiant = models.CharField("Agent", max_length=150, db_index=True)
    agent_nom = models.CharField("Nom", max_length=150, blank=True)
    affecte_par = models.CharField("Affecte par", max_length=150, blank=True)

    class Meta:
        db_table = "affectation_projet"
        constraints = [
            models.UniqueConstraint(
                fields=["projet", "agent_identifiant"],
                name="une_affectation_par_agent_et_projet",
            )
        ]
        ordering = ["agent_nom"]
        verbose_name = "Affectation"
        verbose_name_plural = "Affectations"

    def __str__(self):
        return f"{self.agent_nom or self.agent_identifiant} sur {self.projet.nom}"


def avancement_moyen(taches) -> int:
    """Moyenne des derniers avancements d'un ensemble de taches.

    Une tache sans mise a jour compte pour zero : elle n'est pas commencee,
    l'ignorer gonflerait artificiellement l'avancement d'un chantier a peine
    demarre.
    """
    derniere = (
        MiseAJourJournaliere.objects.filter(tache=OuterRef("pk"))
        .order_by("-date_rapport", "-id")
        .values("avancement")[:1]
    )
    valeurs = list(
        taches.annotate(dernier=Subquery(derniere)).values_list("dernier", flat=True)
    )
    if not valeurs:
        return 0
    return round(sum(valeur or 0 for valeur in valeurs) / len(valeurs))


class Phase(Horodate):
    projet = models.ForeignKey(Projet, on_delete=models.CASCADE, related_name="phases")
    nom = models.CharField("Nom", max_length=255)
    ordre = models.IntegerField("Ordre", default=0)
    masquee_partenaire = models.BooleanField("Masquee au partenaire", default=False)

    class Meta:
        db_table = "phase"
        ordering = ["ordre", "id"]
        verbose_name = "Phase"
        verbose_name_plural = "Phases"

    def __str__(self):
        return f"{self.nom} ({self.projet.nom})"

    def taches(self):
        return Tache.objects.filter(sous_phase__phase=self)

    def avancement(self) -> int:
        return avancement_moyen(self.taches())


class SousPhase(Horodate):
    phase = models.ForeignKey(
        Phase, on_delete=models.CASCADE, related_name="sous_phases"
    )
    nom = models.CharField("Nom", max_length=255)
    ordre = models.IntegerField("Ordre", default=0)
    masquee_partenaire = models.BooleanField("Masquee au partenaire", default=False)

    class Meta:
        db_table = "sous_phase"
        ordering = ["ordre", "id"]
        verbose_name = "Sous-phase"
        verbose_name_plural = "Sous-phases"

    def __str__(self):
        return self.nom

    def avancement(self) -> int:
        return avancement_moyen(self.taches.all())


class Tache(Horodate):
    """Une activite du chantier.

    `jour_debut` et `duree_jours` sont relatifs au demarrage du projet : c'est
    ainsi que le planning d'origine etait saisi, et le conserver evite de
    devoir recalculer toutes les dates quand un chantier glisse.
    """

    sous_phase = models.ForeignKey(
        SousPhase, on_delete=models.CASCADE, related_name="taches"
    )
    activite = models.CharField("Activite", max_length=500)
    jour_debut = models.IntegerField(
        "Jour de debut", default=1, help_text="Compte a partir du demarrage du projet."
    )
    duree_jours = models.IntegerField("Duree (jours)", default=1)
    ordre = models.IntegerField("Ordre", default=0)
    masquee_partenaire = models.BooleanField("Masquee au partenaire", default=False)

    class Meta:
        db_table = "tache"
        ordering = ["ordre", "id"]
        verbose_name = "Tache"
        verbose_name_plural = "Taches"

    def __str__(self):
        return self.activite

    def derniere_mise_a_jour(self):
        return self.mises_a_jour.order_by("-date_rapport", "-id").first()

    def avancement(self) -> int:
        derniere = self.derniere_mise_a_jour()
        return derniere.avancement if derniere else 0

    def avancement_au(self, jour):
        mise_a_jour = self.mises_a_jour.filter(date_rapport=jour).first()
        return mise_a_jour.avancement if mise_a_jour else None


class MiseAJourJournaliere(Horodate):
    """Ce qui a ete fait sur une tache, un jour donne.

    Une seule par tache et par jour : deux saisies contradictoires le meme
    jour rendraient le rapport journalier indefendable devant un client.
    """

    tache = models.ForeignKey(
        Tache, on_delete=models.CASCADE, related_name="mises_a_jour"
    )
    agent_identifiant = models.CharField("Saisi par", max_length=150, blank=True)
    agent_nom = models.CharField("Nom", max_length=150, blank=True)
    date_rapport = models.DateField("Date")
    avancement = models.IntegerField(
        "Avancement",
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    statut = models.CharField(
        "Statut",
        max_length=12,
        choices=StatutTache.choices,
        default=StatutTache.NON_DEMARRE,
    )
    commentaire = models.TextField("Commentaire", blank=True)

    class Meta:
        db_table = "mise_a_jour_journaliere"
        constraints = [
            models.UniqueConstraint(
                fields=["tache", "date_rapport"], name="une_saisie_par_tache_et_jour"
            )
        ]
        ordering = ["-date_rapport", "-id"]
        verbose_name = "Mise a jour journaliere"
        verbose_name_plural = "Mises a jour journalieres"

    def __str__(self):
        return f"{self.tache.activite} - {self.date_rapport}"

    @staticmethod
    def statut_pour(avancement: int) -> str:
        """Le statut se deduit de l'avancement, il ne se saisit pas.

        Laisser les deux independants produisait des taches « en cours » a
        100 % et des taches « terminees » a 40 %.
        """
        if avancement >= 100:
            return StatutTache.TERMINE
        if avancement > 0:
            return StatutTache.EN_COURS
        return StatutTache.NON_DEMARRE

    def save(self, *args, **kwargs):
        self.statut = self.statut_pour(self.avancement)
        super().save(*args, **kwargs)


class NoteAvancement(Horodate):
    """Le commentaire qui accompagne un saut d'avancement.

    On garde l'avancement precedent a cote du nouveau : « passe de 30 a 80 %
    parce que la dalle a ete coulee » se relit des mois plus tard, « 80 % » ne
    se relit pas.
    """

    tache = models.ForeignKey(
        Tache, on_delete=models.CASCADE, related_name="notes_avancement"
    )
    mise_a_jour = models.ForeignKey(
        MiseAJourJournaliere,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="notes",
    )
    agent_identifiant = models.CharField("Redigee par", max_length=150, blank=True)
    agent_nom = models.CharField("Nom", max_length=150, blank=True)
    avancement = models.IntegerField("Avancement", default=0)
    avancement_precedent = models.IntegerField("Avancement precedent", default=0)
    corps = models.TextField("Note", blank=True)

    class Meta:
        db_table = "note_avancement"
        ordering = ["-cree_le"]
        verbose_name = "Note d'avancement"
        verbose_name_plural = "Notes d'avancement"

    def __str__(self):
        return f"{self.avancement_precedent} -> {self.avancement} %"


class CategoriePhoto(models.TextChoices):
    AVANT = "AVANT", "Avant"
    PENDANT = "PENDANT", "Pendant"
    APRES = "APRES", "Apres"
    SECURITE = "SECURITE", "Securite"
    QUALITE = "QUALITE", "Qualite"


class Photo(Horodate):
    projet = models.ForeignKey(Projet, on_delete=models.CASCADE, related_name="photos")
    agent_identifiant = models.CharField("Prise par", max_length=150, blank=True)
    agent_nom = models.CharField("Nom", max_length=150, blank=True)
    categorie = models.CharField(
        "Categorie", max_length=10, choices=CategoriePhoto.choices
    )
    fichier = models.FileField("Fichier", upload_to="chantiers/photos/%Y/%m/")
    nom_origine = models.CharField("Nom d'origine", max_length=255, blank=True)
    legende = models.CharField("Legende", max_length=255, blank=True)
    prise_le = models.DateField("Prise le", null=True, blank=True)
    taille = models.PositiveIntegerField("Taille (octets)", default=0)

    class Meta:
        db_table = "photo_chantier"
        ordering = ["-cree_le"]
        verbose_name = "Photo"
        verbose_name_plural = "Photos"

    def __str__(self):
        return f"{self.get_categorie_display()} - {self.projet.nom}"


class RapportJournalier(Horodate):
    """Le rapport du jour, avec la meteo : sur un chantier, elle explique tout.

    Une journee de pluie a Bamako arrete le coulage du beton ; sans la
    consigner, un retard devient inexplicable trois mois plus tard.
    """

    projet = models.ForeignKey(
        Projet, on_delete=models.CASCADE, related_name="rapports"
    )
    agent_identifiant = models.CharField("Redige par", max_length=150, blank=True)
    agent_nom = models.CharField("Nom", max_length=150, blank=True)
    date_rapport = models.DateField("Date")
    temperature = models.DecimalField(
        "Temperature", max_digits=4, decimal_places=1, null=True, blank=True
    )
    meteo = models.CharField("Meteo", max_length=100, blank=True)
    avancement_global = models.IntegerField("Avancement global", default=0)
    notes = models.TextField("Notes", blank=True)

    class Meta:
        db_table = "rapport_journalier"
        constraints = [
            models.UniqueConstraint(
                fields=["projet", "date_rapport"], name="un_rapport_par_projet_et_jour"
            )
        ]
        ordering = ["-date_rapport"]
        verbose_name = "Rapport journalier"
        verbose_name_plural = "Rapports journaliers"

    def __str__(self):
        return f"{self.projet.nom} - {self.date_rapport}"


class JournalActivite(Horodate):
    """Qui a fait quoi sur le chantier.

    Un chantier se conteste : « la tache avait ete declaree terminee le 3 » se
    verifie ici, et nulle part ailleurs.
    """

    agent_identifiant = models.CharField("Agent", max_length=150, blank=True)
    agent_nom = models.CharField("Nom", max_length=150, blank=True)
    action = models.CharField("Action", max_length=100)
    objet_type = models.CharField("Type d'objet", max_length=100, blank=True)
    objet_id = models.PositiveBigIntegerField("Objet", null=True, blank=True)
    projet_id = models.PositiveBigIntegerField("Projet", null=True, blank=True)
    description = models.TextField("Description", blank=True)
    details = models.JSONField("Details", default=dict, blank=True)
    adresse_ip = models.GenericIPAddressField("Adresse IP", null=True, blank=True)

    class Meta:
        db_table = "journal_activite_chantier"
        ordering = ["-cree_le"]
        indexes = [models.Index(fields=["projet_id", "-cree_le"])]
        verbose_name = "Journal d'activite"
        verbose_name_plural = "Journal d'activite"

    def __str__(self):
        return f"{self.action} - {self.agent_nom}"
