"""Modeles du domaine Finance.

Origine du code repris : FinanceRH/backend/finance (Django 6 + DRF), en
production sur rh.gdamali.net.

Le domaine couvre la depense de bout en bout :

    besoin -> requisition -> demande de prix -> bon de commande -> depense

plus deux circuits paralleles : la **caisse** (menue depense en especes) et
les **missions** (perdiem et frais). Les forfaits de communication ferment la
marche : ce sont des depenses recurrentes suivies au mois.

Six de ces objets sont des documents validables — requisition, bon de
commande, sortie de caisse, depense, mission, prestation. Ils partagent le
circuit commun de l'ERP, avec les regles configurees pour leur type.

Comme partout ailleurs, un agent cite ici n'est pas une cle etrangere : il
appartient a `organisation`, et l'on n'en garde que l'identifiant de connexion
et le nom affiche.
"""

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Sum
from gdahub_common.agents import ReferenceAgent
from gdahub_common.constantes import Devise, StatutDocument, TypeDocument
from gdahub_common.validation.models import DocumentFinancier, Horodate

MONTANT = {"max_digits": 14, "decimal_places": 2}


class Priorite(models.TextChoices):
    BASSE = "BASSE", "Basse"
    NORMALE = "NORMALE", "Normale"
    HAUTE = "HAUTE", "Haute"
    URGENTE = "URGENTE", "Urgente"


class ModePaiement(models.TextChoices):
    ESPECES = "ESPECES", "Especes"
    CHEQUE = "CHEQUE", "Cheque"
    VIREMENT = "VIREMENT", "Virement bancaire"
    MOBILE = "MOBILE", "Mobile money"


# ---------------------------------------------------------------------------
# Referentiels
# ---------------------------------------------------------------------------


class Fournisseur(Horodate):
    code = models.CharField("Code", max_length=20, unique=True)
    raison_sociale = models.CharField("Raison sociale", max_length=180)
    categorie = models.CharField("Categorie", max_length=80, blank=True)
    contact = models.CharField("Contact", max_length=120, blank=True)
    telephone = models.CharField("Telephone", max_length=30, blank=True)
    email = models.EmailField("Adresse e-mail", blank=True)
    adresse = models.CharField("Adresse", max_length=255, blank=True)
    numero_fiscal = models.CharField("Numero fiscal", max_length=50, blank=True)
    actif = models.BooleanField("Fournisseur actif", default=True)

    class Meta:
        db_table = "fournisseur"
        ordering = ["raison_sociale"]
        verbose_name = "Fournisseur"
        verbose_name_plural = "Fournisseurs"

    def __str__(self):
        return self.raison_sociale


class CategorieDepense(Horodate):
    code = models.CharField("Code", max_length=20, unique=True)
    libelle = models.CharField("Libelle", max_length=120)
    imputation = models.CharField(
        "Imputation",
        max_length=40,
        blank=True,
        help_text="Compte ou rubrique budgetaire.",
    )
    actif = models.BooleanField("Categorie active", default=True)

    class Meta:
        db_table = "categorie_depense"
        ordering = ["libelle"]
        verbose_name = "Categorie de depense"
        verbose_name_plural = "Categories de depense"

    def __str__(self):
        return self.libelle


class ReferenceDepartement(models.Model):
    """Le departement impute, recopie de l'annuaire.

    Une depense s'impute a une unite ; celle-ci appartient a `organisation`.
    On recopie donc son numero et son nom, comme partout ailleurs.
    """

    departement_id = models.PositiveBigIntegerField(
        "Departement", null=True, blank=True, db_index=True
    )
    departement_nom = models.CharField(
        "Nom du departement", max_length=120, blank=True
    )

    class Meta:
        abstract = True


# ---------------------------------------------------------------------------
# Requisitions
# ---------------------------------------------------------------------------


class Requisition(ReferenceDepartement, DocumentFinancier):
    """L'expression d'un besoin, chiffree ligne a ligne.

    Le montant n'est pas saisi : il se recalcule a chaque mouvement de ligne.
    C'est ce qui garantit que le circuit de validation route la demande sur le
    bon montant — une requisition dont le total ne correspond pas a ses lignes
    passerait devant les mauvais valideurs.
    """

    PREFIXE_NUMERO = "REQ"
    TYPE_DOCUMENT = TypeDocument.REQUISITION

    objet = models.CharField("Objet", max_length=200)
    justification = models.TextField("Justification", blank=True)
    date_besoin = models.DateField("Date du besoin", null=True, blank=True)
    priorite = models.CharField(
        "Priorite", max_length=10, choices=Priorite.choices, default=Priorite.NORMALE
    )
    montant = models.DecimalField("Montant", default=Decimal("0"), **MONTANT)

    class Meta(DocumentFinancier.Meta):
        db_table = "requisition"
        verbose_name = "Requisition"
        verbose_name_plural = "Requisitions"

    def recalculer_montant(self):
        total = self.lignes.aggregate(total=Sum("montant"))["total"] or Decimal("0")
        if total != self.montant:
            self.montant = total
            self.save(update_fields=["montant", "modifie_le"])
        return self.montant


class LigneRequisition(Horodate):
    requisition = models.ForeignKey(
        Requisition, on_delete=models.CASCADE, related_name="lignes"
    )
    designation = models.CharField("Designation", max_length=200)
    quantite = models.DecimalField(
        "Quantite",
        max_digits=10,
        decimal_places=2,
        default=Decimal("1"),
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    unite = models.CharField("Unite", max_length=20, blank=True)
    prix_unitaire = models.DecimalField(
        "Prix unitaire", default=Decimal("0"), **MONTANT
    )
    montant = models.DecimalField(
        "Montant", default=Decimal("0"), editable=False, **MONTANT
    )

    class Meta:
        db_table = "ligne_requisition"
        ordering = ["id"]
        verbose_name = "Ligne de requisition"
        verbose_name_plural = "Lignes de requisition"

    def __str__(self):
        return f"{self.designation} x{self.quantite}"

    def save(self, *args, **kwargs):
        self.montant = (self.quantite or 0) * (self.prix_unitaire or 0)
        super().save(*args, **kwargs)
        self.requisition.recalculer_montant()

    def delete(self, *args, **kwargs):
        requisition = self.requisition
        super().delete(*args, **kwargs)
        requisition.recalculer_montant()


# ---------------------------------------------------------------------------
# Demandes de prix et achats
# ---------------------------------------------------------------------------


class StatutDemandePrix(models.TextChoices):
    OUVERTE = "OUVERTE", "Ouverte"
    EN_ANALYSE = "EN_ANALYSE", "En analyse"
    ATTRIBUEE = "ATTRIBUEE", "Attribuee"
    INFRUCTUEUSE = "INFRUCTUEUSE", "Infructueuse"


class DemandePrix(Horodate):
    """La mise en concurrence. Elle ne passe pas par le circuit de validation.

    Consulter des fournisseurs n'engage rien : c'est le bon de commande qui
    engage, et lui est validable. Soumettre la consultation elle-meme a un
    circuit ne ferait que retarder la collecte des offres.
    """

    numero = models.CharField("Numero", max_length=32, unique=True, editable=False)
    requisition = models.ForeignKey(
        Requisition,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="demandes_prix",
    )
    objet = models.CharField("Objet", max_length=200)
    description = models.TextField("Description", blank=True)
    date_lancement = models.DateField("Date de lancement", null=True, blank=True)
    date_limite = models.DateField("Date limite", null=True, blank=True)
    critere_attribution = models.CharField(
        "Critere d'attribution",
        max_length=120,
        default="Mieux-disant (prix et delai)",
    )
    statut = models.CharField(
        "Statut",
        max_length=14,
        choices=StatutDemandePrix.choices,
        default=StatutDemandePrix.OUVERTE,
    )
    acheteur_identifiant = models.CharField("Acheteur", max_length=150, blank=True)
    acheteur_nom = models.CharField("Nom de l'acheteur", max_length=150, blank=True)

    class Meta:
        db_table = "demande_prix"
        ordering = ["-cree_le"]
        verbose_name = "Demande de prix"
        verbose_name_plural = "Demandes de prix"

    def __str__(self):
        return f"{self.numero} - {self.objet}"

    def save(self, *args, **kwargs):
        if not self.numero:
            from gdahub_common.validation.models import generer_numero

            self.numero = generer_numero("DP")
        super().save(*args, **kwargs)

    @property
    def offre_retenue(self):
        return self.offres.filter(retenue=True).first()


class OffreFournisseur(Horodate):
    demande_prix = models.ForeignKey(
        DemandePrix, on_delete=models.CASCADE, related_name="offres"
    )
    fournisseur = models.ForeignKey(
        Fournisseur, on_delete=models.PROTECT, related_name="offres"
    )
    montant = models.DecimalField("Montant", **MONTANT)
    devise = models.CharField(
        "Devise", max_length=3, choices=Devise.choices, default=Devise.XOF
    )
    delai_livraison_jours = models.PositiveSmallIntegerField(
        "Delai de livraison (jours)", default=0
    )
    conditions_paiement = models.CharField(
        "Conditions de paiement", max_length=150, blank=True
    )
    note_technique = models.PositiveSmallIntegerField(
        "Note technique", default=0, help_text="Appreciation technique sur 20."
    )
    retenue = models.BooleanField("Offre retenue", default=False)
    commentaire = models.TextField("Commentaire", blank=True)

    class Meta:
        db_table = "offre_fournisseur"
        constraints = [
            models.UniqueConstraint(
                fields=["demande_prix", "fournisseur"],
                name="une_offre_par_fournisseur_et_consultation",
            )
        ]
        ordering = ["montant"]
        verbose_name = "Offre fournisseur"
        verbose_name_plural = "Offres fournisseurs"

    def __str__(self):
        return f"{self.fournisseur} - {self.montant}"


class BonCommande(DocumentFinancier):
    PREFIXE_NUMERO = "BC"
    TYPE_DOCUMENT = TypeDocument.BON_COMMANDE

    requisition = models.ForeignKey(
        Requisition,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="bons_commande",
    )
    demande_prix = models.ForeignKey(
        DemandePrix,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="bons_commande",
    )
    fournisseur = models.ForeignKey(
        Fournisseur, on_delete=models.PROTECT, related_name="bons_commande"
    )
    objet = models.CharField("Objet", max_length=200)
    montant = models.DecimalField("Montant", **MONTANT)
    date_livraison_prevue = models.DateField(
        "Livraison prevue", null=True, blank=True
    )
    date_livraison_reelle = models.DateField("Livraison reelle", null=True, blank=True)
    conditions = models.TextField("Conditions", blank=True)

    class Meta(DocumentFinancier.Meta):
        db_table = "bon_commande"
        verbose_name = "Bon de commande"
        verbose_name_plural = "Bons de commande"


# ---------------------------------------------------------------------------
# Caisse et depenses
# ---------------------------------------------------------------------------


class Caisse(Horodate):
    """Une caisse d'especes, avec son solde calcule.

    Le solde n'est jamais stocke : il se deduit des mouvements. Un solde
    enregistre finit toujours par diverger de son historique, et c'est
    precisement ce qu'une caisse ne peut pas se permettre.
    """

    code = models.CharField("Code", max_length=20, unique=True)
    libelle = models.CharField("Libelle", max_length=120)
    responsable_identifiant = models.CharField(
        "Responsable", max_length=150, blank=True
    )
    responsable_nom = models.CharField(
        "Nom du responsable", max_length=150, blank=True
    )
    devise = models.CharField(
        "Devise", max_length=3, choices=Devise.choices, default=Devise.XOF
    )
    solde_initial = models.DecimalField(
        "Solde initial", default=Decimal("0"), **MONTANT
    )
    plafond_alerte = models.DecimalField(
        "Plafond d'alerte",
        default=Decimal("0"),
        help_text="Seuil declenchant une alerte de reapprovisionnement.",
        **MONTANT,
    )
    actif = models.BooleanField("Caisse active", default=True)

    class Meta:
        db_table = "caisse"
        ordering = ["libelle"]
        verbose_name = "Caisse"
        verbose_name_plural = "Caisses"

    def __str__(self):
        return f"{self.code} - {self.libelle}"

    @property
    def total_decaisse(self) -> Decimal:
        """Seules les sorties cloturees ont quitte la caisse.

        Une sortie approuvee mais non encore decaissee est un engagement, pas
        un mouvement : la compter reviendrait a montrer un solde plus bas que
        les especes reellement presentes.
        """
        return self.sorties.filter(statut=StatutDocument.CLOTURE).aggregate(
            total=Sum("montant")
        )["total"] or Decimal("0")

    @property
    def total_approvisionne(self) -> Decimal:
        return self.approvisionnements.aggregate(total=Sum("montant"))[
            "total"
        ] or Decimal("0")

    @property
    def solde_actuel(self) -> Decimal:
        return self.solde_initial + self.total_approvisionne - self.total_decaisse

    @property
    def sous_alerte(self) -> bool:
        return self.solde_actuel <= self.plafond_alerte


class ApprovisionnementCaisse(Horodate):
    caisse = models.ForeignKey(
        Caisse, on_delete=models.CASCADE, related_name="approvisionnements"
    )
    montant = models.DecimalField("Montant", **MONTANT)
    date_operation = models.DateField("Date de l'operation")
    reference = models.CharField("Reference", max_length=60, blank=True)
    commentaire = models.CharField("Commentaire", max_length=255, blank=True)
    enregistre_par_identifiant = models.CharField(
        "Enregistre par", max_length=150, blank=True
    )
    enregistre_par_nom = models.CharField(
        "Nom de l'operateur", max_length=150, blank=True
    )

    class Meta:
        db_table = "approvisionnement_caisse"
        ordering = ["-date_operation"]
        verbose_name = "Approvisionnement de caisse"
        verbose_name_plural = "Approvisionnements de caisse"

    def __str__(self):
        return f"{self.caisse} + {self.montant}"


class SortieCaisse(DocumentFinancier):
    PREFIXE_NUMERO = "SC"
    TYPE_DOCUMENT = TypeDocument.SORTIE_CAISSE

    caisse = models.ForeignKey(Caisse, on_delete=models.PROTECT, related_name="sorties")
    categorie = models.ForeignKey(
        CategorieDepense,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="sorties_caisse",
    )
    beneficiaire = models.CharField("Beneficiaire", max_length=180)
    beneficiaire_identifiant = models.CharField(
        "Agent beneficiaire",
        max_length=150,
        blank=True,
        help_text="Quand le beneficiaire est un agent du groupe.",
    )
    motif = models.TextField("Motif")
    montant = models.DecimalField("Montant", **MONTANT)
    date_sortie = models.DateField("Date de sortie")
    piece_justificative = models.FileField(
        "Piece justificative",
        upload_to="justificatifs/caisse/",
        null=True,
        blank=True,
    )
    date_decaissement = models.DateTimeField(
        "Date de decaissement", null=True, blank=True
    )
    decaisse_par_identifiant = models.CharField(
        "Decaisse par", max_length=150, blank=True
    )

    class Meta(DocumentFinancier.Meta):
        db_table = "sortie_caisse"
        verbose_name = "Sortie de caisse"
        verbose_name_plural = "Sorties de caisse"


class Depense(ReferenceDepartement, DocumentFinancier):
    PREFIXE_NUMERO = "DEP"
    TYPE_DOCUMENT = TypeDocument.DEPENSE

    categorie = models.ForeignKey(
        CategorieDepense, on_delete=models.PROTECT, related_name="depenses"
    )
    fournisseur = models.ForeignKey(
        Fournisseur,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="depenses",
    )
    libelle = models.CharField("Libelle", max_length=200)
    description = models.TextField("Description", blank=True)
    montant = models.DecimalField("Montant", **MONTANT)
    date_depense = models.DateField("Date de la depense")
    mode_paiement = models.CharField(
        "Mode de paiement",
        max_length=10,
        choices=ModePaiement.choices,
        default=ModePaiement.VIREMENT,
    )
    reference_paiement = models.CharField(
        "Reference de paiement", max_length=80, blank=True
    )
    piece_justificative = models.FileField(
        "Piece justificative",
        upload_to="justificatifs/depenses/",
        null=True,
        blank=True,
    )

    class Meta(DocumentFinancier.Meta):
        db_table = "depense"
        verbose_name = "Depense"
        verbose_name_plural = "Depenses"


# ---------------------------------------------------------------------------
# Missions, perdiems et frais
# ---------------------------------------------------------------------------


class ZoneMission(models.TextChoices):
    LOCALE = "LOCALE", "Locale (meme ville)"
    NATIONALE = "NATIONALE", "Nationale"
    SOUS_REGION = "SOUS_REGION", "Sous-region"
    INTERNATIONALE = "INTERNATIONALE", "Internationale"


class BaremePerdiem(Horodate):
    """Montant journalier de perdiem par zone et par niveau de responsabilite."""

    libelle = models.CharField("Libelle", max_length=120)
    zone = models.CharField("Zone", max_length=15, choices=ZoneMission.choices)
    role_agent = models.CharField(
        "Role vise",
        max_length=40,
        blank=True,
        help_text="Vide = applicable a tous les roles.",
    )
    montant_jour = models.DecimalField("Montant par jour", **MONTANT)
    devise = models.CharField(
        "Devise", max_length=3, choices=Devise.choices, default=Devise.XOF
    )
    actif = models.BooleanField("Bareme actif", default=True)

    class Meta:
        db_table = "bareme_perdiem"
        ordering = ["zone", "-montant_jour"]
        verbose_name = "Bareme de perdiem"
        verbose_name_plural = "Baremes de perdiem"

    def __str__(self):
        return f"{self.libelle} ({self.montant_jour}/jour)"


class Mission(DocumentFinancier):
    """Un ordre de mission, avec son perdiem et ses frais.

    Le montant se recalcule a chaque enregistrement : perdiem selon le bareme
    et la duree, plus les frais annonces. Le laisser saisir a la main ferait
    router la demande sur un montant sans rapport avec ce qu'elle coute.
    """

    PREFIXE_NUMERO = "MIS"
    TYPE_DOCUMENT = TypeDocument.MISSION

    objet = models.CharField("Objet", max_length=200)
    destination = models.CharField("Destination", max_length=150)
    zone = models.CharField(
        "Zone",
        max_length=15,
        choices=ZoneMission.choices,
        default=ZoneMission.NATIONALE,
    )
    date_depart = models.DateField("Depart")
    date_retour = models.DateField("Retour")
    moyen_transport = models.CharField("Moyen de transport", max_length=80, blank=True)
    #: Les accompagnants, sous forme d'instantanes. Une liste plutot qu'une
    #: relation : les agents appartiennent a `organisation`.
    participants = models.JSONField("Participants", default=list, blank=True)
    bareme = models.ForeignKey(
        BaremePerdiem,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="missions",
    )
    nb_jours = models.PositiveSmallIntegerField("Nombre de jours", default=1)
    montant_perdiem = models.DecimalField("Perdiem", default=Decimal("0"), **MONTANT)
    frais_transport = models.DecimalField(
        "Frais de transport", default=Decimal("0"), **MONTANT
    )
    frais_hebergement = models.DecimalField(
        "Frais d'hebergement", default=Decimal("0"), **MONTANT
    )
    autres_frais = models.DecimalField("Autres frais", default=Decimal("0"), **MONTANT)
    montant = models.DecimalField(
        "Montant total", default=Decimal("0"), editable=False, **MONTANT
    )
    rapport = models.TextField("Rapport de mission", blank=True)
    date_rapport = models.DateField("Date du rapport", null=True, blank=True)

    class Meta(DocumentFinancier.Meta):
        db_table = "mission"
        verbose_name = "Mission"
        verbose_name_plural = "Missions"

    def save(self, *args, **kwargs):
        self.nb_jours = max((self.date_retour - self.date_depart).days + 1, 1)
        if self.bareme:
            self.montant_perdiem = self.bareme.montant_jour * self.nb_jours
        self.montant = (
            self.montant_perdiem
            + self.frais_transport
            + self.frais_hebergement
            + self.autres_frais
        )
        super().save(*args, **kwargs)


class LigneFraisMission(Horodate):
    """Justificatif de depense engage pendant la mission, saisi au retour."""

    mission = models.ForeignKey(Mission, on_delete=models.CASCADE, related_name="frais")
    libelle = models.CharField("Libelle", max_length=180)
    categorie = models.ForeignKey(
        CategorieDepense,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="frais_mission",
    )
    montant = models.DecimalField("Montant", **MONTANT)
    date_depense = models.DateField("Date")
    justificatif = models.FileField(
        "Justificatif", upload_to="justificatifs/missions/", null=True, blank=True
    )
    valide = models.BooleanField("Frais valide", default=False)

    class Meta:
        db_table = "ligne_frais_mission"
        ordering = ["date_depense"]
        verbose_name = "Ligne de frais de mission"
        verbose_name_plural = "Lignes de frais de mission"

    def __str__(self):
        return f"{self.libelle} - {self.montant}"


class Prestation(DocumentFinancier):
    PREFIXE_NUMERO = "PRE"
    TYPE_DOCUMENT = TypeDocument.PRESTATION

    prestataire = models.ForeignKey(
        Fournisseur, on_delete=models.PROTECT, related_name="prestations"
    )
    objet = models.CharField("Objet", max_length=200)
    description = models.TextField("Description", blank=True)
    date_debut = models.DateField("Debut")
    date_fin = models.DateField("Fin", null=True, blank=True)
    montant = models.DecimalField("Montant", **MONTANT)
    livrables = models.TextField("Livrables", blank=True)
    taux_execution = models.PositiveSmallIntegerField(
        "Taux d'execution",
        default=0,
        help_text="Avancement de la prestation en pourcentage.",
    )

    class Meta(DocumentFinancier.Meta):
        db_table = "prestation"
        verbose_name = "Prestation"
        verbose_name_plural = "Prestations"


# ---------------------------------------------------------------------------
# Forfaits de communication
# ---------------------------------------------------------------------------


class TypeForfait(models.TextChoices):
    VOIX = "VOIX", "Voix"
    DATA = "DATA", "Internet / data"
    MIXTE = "MIXTE", "Voix + data"


class ForfaitCommunication(ReferenceAgent, Horodate):
    operateur = models.CharField("Operateur", max_length=60)
    numero_ligne = models.CharField("Numero de ligne", max_length=30)
    type_forfait = models.CharField(
        "Type de forfait",
        max_length=6,
        choices=TypeForfait.choices,
        default=TypeForfait.MIXTE,
    )
    montant_mensuel = models.DecimalField("Montant mensuel", **MONTANT)
    devise = models.CharField(
        "Devise", max_length=3, choices=Devise.choices, default=Devise.XOF
    )
    date_debut = models.DateField("Debut")
    date_fin = models.DateField("Fin", null=True, blank=True)
    actif = models.BooleanField("Forfait actif", default=True)

    class Meta:
        db_table = "forfait_communication"
        ordering = ["agent_nom"]
        verbose_name = "Forfait de communication"
        verbose_name_plural = "Forfaits de communication"

    def __str__(self):
        return f"{self.agent_nom} - {self.numero_ligne}"


class ConsommationCommunication(Horodate):
    forfait = models.ForeignKey(
        ForfaitCommunication, on_delete=models.CASCADE, related_name="consommations"
    )
    mois = models.DateField("Mois", help_text="Premier jour du mois concerne.")
    montant_consomme = models.DecimalField("Montant consomme", **MONTANT)
    commentaire = models.CharField("Commentaire", max_length=255, blank=True)

    class Meta:
        db_table = "consommation_communication"
        constraints = [
            models.UniqueConstraint(
                fields=["forfait", "mois"], name="une_consommation_par_mois"
            )
        ]
        ordering = ["-mois"]
        verbose_name = "Consommation communication"
        verbose_name_plural = "Consommations communication"

    def __str__(self):
        return f"{self.forfait} - {self.mois:%m/%Y}"

    @property
    def depassement(self) -> Decimal:
        return max(self.montant_consomme - self.forfait.montant_mensuel, Decimal("0"))
