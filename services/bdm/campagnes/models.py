"""Modeles du domaine Campagnes.

Origine du code repris : `DocsERP/BDM/backend` (Django + Inertia sur un schema
herite de Laravel), applications `core`, `campagnes` et `terrain`.

GDA vend des cartes bancaires **pour le compte de banques**. Une campagne est
donc une operation commerciale menee pour un partenaire, sur un perimetre
d'agences et de commerciaux, pendant une periode.

    partenaire -> campagne -> vente / enrolement -> prime

**La regle qui structure tout le domaine** : certains partenaires n'ont pas de
reseau d'agences. La BDM en a cinquante-quatre ; UBA n'en a aucune et ses
commerciaux dependent directement du partenaire. Tout le decoupage par agence
— perimetre, ouverture des ecrans, signature du contrat — est alors sans objet
et court-circuite. C'est `sans_agences`, et l'oublier fait remonter les
cinquante-quatre agences de la BDM dans une campagne UBA.

**Ce qui change par rapport a la source** : les utilisateurs ne sont plus des
lignes de cette base. Un commercial appartient a `organisation` ; on n'en garde
ici que l'identifiant de connexion et le nom affiche, comme partout ailleurs
dans l'ERP.
"""

from datetime import date, timedelta

from django.db import models
from django.utils import timezone
from gdahub_common.validation.models import Horodate

#: Un commercial corrige ses saisies pendant deux jours, puis elles se figent.
#: Passe ce delai, une correction se demande a l'administration : c'est ce qui
#: evite qu'une vente disparaisse le jour ou l'on calcule les primes.
DELAI_CORRECTION_HEURES = 48


def dans_le_delai(depuis) -> bool:
    if depuis is None:
        return False
    return depuis > timezone.now() - timedelta(hours=DELAI_CORRECTION_HEURES)


class Organisation(models.TextChoices):
    AGENCES = "AGENCES", "Reseau d'agences"
    DIRECTE = "DIRECTE", "Commerciaux directs"


class Partenaire(Horodate):
    """La banque pour laquelle GDA mene la campagne."""

    code = models.CharField("Code", max_length=30, unique=True)
    nom = models.CharField("Nom", max_length=100)
    nom_complet = models.CharField("Raison sociale", max_length=255, blank=True)
    organisation = models.CharField(
        "Organisation",
        max_length=10,
        choices=Organisation.choices,
        default=Organisation.AGENCES,
    )
    fiche_adhesion = models.BooleanField(
        "Fiche d'adhesion exigee",
        default=False,
        help_text="UBA exige une demande d'adhesion VISA en plus de la vente.",
    )
    ordre = models.PositiveIntegerField("Ordre d'affichage", default=0)
    actif = models.BooleanField("Partenaire actif", default=True)

    class Meta:
        db_table = "partenaire"
        ordering = ["ordre", "nom"]
        verbose_name = "Partenaire"
        verbose_name_plural = "Partenaires"

    def __str__(self):
        return self.nom

    @property
    def a_des_agences(self) -> bool:
        return self.organisation == Organisation.AGENCES


class Agence(Horodate):
    partenaire = models.ForeignKey(
        Partenaire, on_delete=models.CASCADE, related_name="agences"
    )
    nom = models.CharField("Nom", max_length=255)
    adresse = models.CharField("Adresse", max_length=255, blank=True)
    ordre = models.PositiveIntegerField("Ordre", default=0)
    chef_identifiant = models.CharField("Chef d'agence", max_length=150, blank=True)
    chef_nom = models.CharField("Nom du chef", max_length=150, blank=True)
    actif = models.BooleanField("Agence active", default=True)

    class Meta:
        db_table = "agence"
        ordering = ["nom"]
        verbose_name = "Agence"
        verbose_name_plural = "Agences"

    def __str__(self):
        return self.nom


class TypeCarte(Horodate):
    partenaire = models.ForeignKey(
        Partenaire,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="types_cartes",
    )
    code = models.CharField("Code", max_length=50, unique=True)
    libelle = models.CharField("Libelle", max_length=150)
    actif = models.BooleanField("Type actif", default=True)

    class Meta:
        db_table = "type_carte"
        ordering = ["libelle"]
        verbose_name = "Type de carte"
        verbose_name_plural = "Types de carte"

    def __str__(self):
        return self.libelle


class Commercial(Horodate):
    """Un commercial engage sur les campagnes d'un partenaire.

    Ce n'est pas un compte : le compte vit chez `identity`, la fiche d'agent
    chez `organisation`. C'est le rattachement commercial — a un partenaire,
    a une agence — qui appartient a ce domaine et a lui seul.
    """

    identifiant = models.CharField(
        "Identifiant de connexion", max_length=150, unique=True
    )
    nom_complet = models.CharField("Nom", max_length=150)
    telephone = models.CharField("Telephone", max_length=20, blank=True)
    partenaire = models.ForeignKey(
        Partenaire,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="commerciaux",
    )
    agence = models.ForeignKey(
        Agence,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="commerciaux",
        help_text="Vide chez un partenaire sans reseau d'agences.",
    )
    telephonique = models.BooleanField(
        "Commercial telephonique",
        default=False,
        help_text="Televendeur : il rend un rapport d'appels, pas des ventes terrain.",
    )
    adresse_contrat = models.TextField("Adresse pour le contrat", blank=True)
    piece_identite_ref = models.CharField(
        "Reference de piece d'identite", max_length=191, blank=True
    )
    actif = models.BooleanField("Commercial actif", default=True)

    class Meta:
        db_table = "commercial"
        ordering = ["nom_complet"]
        indexes = [models.Index(fields=["partenaire", "agence"])]
        verbose_name = "Commercial"
        verbose_name_plural = "Commerciaux"

    def __str__(self):
        return self.nom_complet


# ---------------------------------------------------------------------------
# Campagnes
# ---------------------------------------------------------------------------


class StatutCampagne(models.TextChoices):
    PROGRAMMEE = "PROGRAMMEE", "Programmee"
    EN_COURS = "EN_COURS", "En cours"
    ARRETEE = "ARRETEE", "Arretee"
    ANNULEE = "ANNULEE", "Annulee"
    TERMINEE = "TERMINEE", "Terminee"


#: Statuts poses a la main : ils ne se recalculent jamais depuis les dates.
STATUTS_MANUELS = {StatutCampagne.ARRETEE, StatutCampagne.ANNULEE}


class TypeCampagne(models.TextChoices):
    VENTE_CARTE = "VENTE_CARTE", "Vente de cartes"
    ENROLEMENT = "ENROLEMENT", "Enrolement application"


class Campagne(Horodate):
    partenaire = models.ForeignKey(
        Partenaire,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="campagnes",
    )
    nom = models.CharField("Nom", max_length=255)
    type_campagne = models.CharField(
        "Type",
        max_length=12,
        choices=TypeCampagne.choices,
        default=TypeCampagne.VENTE_CARTE,
    )
    date_debut = models.DateField("Debut")
    date_fin = models.DateField("Fin")
    statut = models.CharField(
        "Statut",
        max_length=12,
        choices=StatutCampagne.choices,
        default=StatutCampagne.PROGRAMMEE,
    )

    # -- Perimetre ----------------------------------------------------------
    toutes_agences = models.BooleanField("Toutes les agences", default=True)
    agences = models.ManyToManyField(
        Agence, blank=True, related_name="campagnes", verbose_name="Agences retenues"
    )
    contrat_tous_commerciaux = models.BooleanField(
        "Tous les commerciaux", default=True
    )
    signataires = models.ManyToManyField(
        Commercial,
        blank=True,
        related_name="campagnes_signees",
        verbose_name="Commerciaux engages",
    )

    # -- Primes et aides ----------------------------------------------------
    prime_meilleur_vendeur = models.DecimalField(
        "Prime du meilleur vendeur", max_digits=12, decimal_places=0, default=25000
    )
    aide_hebdo_active = models.BooleanField("Aide hebdomadaire", default=False)
    aide_hebdo_montant = models.PositiveIntegerField("Montant hebdomadaire", default=5000)
    aide_hebdo_carburant = models.PositiveIntegerField("Dont carburant", default=3000)
    aide_hebdo_credit_tel = models.PositiveIntegerField("Dont credit telephone", default=2000)
    aide_hebdo_tous = models.BooleanField("Aide pour tous", default=True)

    # -- Contrat de prestation ---------------------------------------------
    contrat_emolument = models.PositiveIntegerField("Emolument forfaitaire", default=50000)
    contrat_forfait_communication = models.PositiveIntegerField(
        "Forfait communication", default=2000
    )
    contrat_forfait_deplacement = models.PositiveIntegerField(
        "Forfait deplacement", default=3000
    )
    contrat_representant = models.CharField(
        "Representant de GDA", max_length=191, blank=True
    )
    contrat_lieu_signature = models.CharField(
        "Lieu de signature", max_length=191, default="Bamako"
    )
    contrat_clause_libre = models.TextField("Clause libre", blank=True)
    contrat_publie_le = models.DateTimeField("Contrat publie le", null=True, blank=True)

    actif = models.BooleanField("Campagne active", default=True)

    class Meta:
        db_table = "campagne"
        ordering = ["-date_debut"]
        verbose_name = "Campagne"
        verbose_name_plural = "Campagnes"

    def __str__(self):
        return self.nom

    # -- Statut -------------------------------------------------------------

    @property
    def statut_effectif(self) -> str:
        """Le statut reel : le statut manuel prime, sinon il suit les dates.

        Une campagne arretee ou annulee le reste, meme si ses dates disent le
        contraire ; c'est une decision, pas un calendrier.
        """
        if self.statut in STATUTS_MANUELS:
            return self.statut
        aujourdhui = date.today()
        if self.date_fin < aujourdhui:
            return StatutCampagne.TERMINEE
        if self.date_debut <= aujourdhui:
            return StatutCampagne.EN_COURS
        return StatutCampagne.PROGRAMMEE

    @property
    def ouverte(self) -> bool:
        return self.actif and self.statut_effectif == StatutCampagne.EN_COURS

    # -- Perimetre ----------------------------------------------------------

    @property
    def sans_agences(self) -> bool:
        """Le partenaire travaille-t-il sans reseau d'agences ?

        UBA n'en a pas : ses commerciaux dependent directement du partenaire,
        et tout le decoupage par agence devient sans objet.
        """
        return bool(self.partenaire_id) and not self.partenaire.a_des_agences

    def concerne_agence(self, agence_id: int) -> bool:
        if self.sans_agences or self.toutes_agences:
            return True
        return self.agences.filter(pk=agence_id).exists()

    def agences_du_perimetre(self):
        """Les agences concernees, bornees au partenaire.

        Sans ce bornage, une campagne UBA marquee « toutes agences »
        remonterait les cinquante-quatre agences de la BDM.
        """
        if self.sans_agences:
            return Agence.objects.none()
        if self.toutes_agences:
            queryset = Agence.objects.filter(actif=True)
            if self.partenaire_id:
                queryset = queryset.filter(partenaire_id=self.partenaire_id)
            return queryset.order_by("nom")
        return self.agences.filter(actif=True).order_by("nom")

    def commerciaux_du_perimetre(self):
        """Les commerciaux engages sur cette campagne.

        Les signataires du contrat, sauf si la campagne vaut pour tous les
        commerciaux du perimetre. Le partenaire borne toujours : un commercial
        BDM n'a rien a faire dans une campagne UBA, meme « tous commerciaux ».
        """
        if not self.contrat_tous_commerciaux:
            return self.signataires.filter(actif=True)

        queryset = Commercial.objects.filter(actif=True)
        if self.partenaire_id:
            queryset = queryset.filter(partenaire_id=self.partenaire_id)
        if self.sans_agences:
            return queryset
        if not self.toutes_agences:
            identifiants = list(self.agences.values_list("id", flat=True))
            if not identifiants:
                return Commercial.objects.none()
            queryset = queryset.filter(agence_id__in=identifiants)
        return queryset

    def engage(self, commercial: "Commercial") -> bool:
        return self.commerciaux_du_perimetre().filter(pk=commercial.pk).exists()


class StatutReponseContrat(models.TextChoices):
    EN_ATTENTE = "EN_ATTENTE", "En attente"
    ACCEPTE = "ACCEPTE", "Accepte"
    REFUSE = "REFUSE", "Refuse"


class ReponseContrat(Horodate):
    """La signature en ligne du contrat de prestation par un commercial."""

    campagne = models.ForeignKey(
        Campagne, on_delete=models.CASCADE, related_name="reponses_contrat"
    )
    commercial = models.ForeignKey(
        Commercial, on_delete=models.CASCADE, related_name="reponses_contrat"
    )
    statut = models.CharField(
        "Statut",
        max_length=10,
        choices=StatutReponseContrat.choices,
        default=StatutReponseContrat.EN_ATTENTE,
    )
    repondu_le = models.DateTimeField("Repondu le", null=True, blank=True)
    motif_refus = models.TextField("Motif du refus", blank=True)

    class Meta:
        db_table = "reponse_contrat"
        constraints = [
            models.UniqueConstraint(
                fields=["campagne", "commercial"],
                name="une_reponse_par_commercial_et_campagne",
            )
        ]
        ordering = ["-cree_le"]
        verbose_name = "Reponse au contrat"
        verbose_name_plural = "Reponses aux contrats"

    def __str__(self):
        return f"{self.commercial.nom_complet} - {self.get_statut_display()}"


class VersementAide(Horodate):
    """Le versement hebdomadaire d'aide a un commercial."""

    campagne = models.ForeignKey(
        Campagne, on_delete=models.CASCADE, related_name="versements_aide"
    )
    commercial = models.ForeignKey(
        Commercial, on_delete=models.CASCADE, related_name="aides"
    )
    semaine_debut = models.DateField("Debut de semaine")
    montant = models.PositiveIntegerField("Montant")
    verse_le = models.DateField("Verse le", null=True, blank=True)
    accuse_le = models.DateTimeField("Accuse de reception", null=True, blank=True)

    class Meta:
        db_table = "versement_aide"
        constraints = [
            models.UniqueConstraint(
                fields=["campagne", "commercial", "semaine_debut"],
                name="un_versement_par_semaine",
            )
        ]
        ordering = ["-semaine_debut"]
        verbose_name = "Versement d'aide"
        verbose_name_plural = "Versements d'aide"

    def __str__(self):
        return f"{self.commercial.nom_complet} - {self.semaine_debut} - {self.montant}"


# ---------------------------------------------------------------------------
# Terrain
# ---------------------------------------------------------------------------


class StatutCarte(models.TextChoices):
    VENDUE = "VENDUE", "Vendue"
    ACTIVEE = "ACTIVEE", "Activee"
    EN_ERREUR = "EN_ERREUR", "En erreur"


class SaisieCommerciale(Horodate):
    """Ce qu'un commercial saisit sur le terrain, et qui se fige au bout de deux jours."""

    commercial = models.ForeignKey(
        Commercial, on_delete=models.PROTECT, related_name="%(class)ss"
    )
    agence = models.ForeignKey(
        Agence,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="%(class)ss",
        help_text="Vide chez un partenaire sans reseau d'agences.",
    )

    class Meta:
        abstract = True

    @property
    def corrigible(self) -> bool:
        """Le commercial peut-il encore corriger sa saisie lui-meme ?

        Passe le delai, la correction se demande a l'administration. C'est ce
        qui evite qu'une vente disparaisse le jour ou l'on calcule les primes.
        """
        return dans_le_delai(self.cree_le)


class Client(SaisieCommerciale):
    type_carte = models.ForeignKey(
        TypeCarte, on_delete=models.PROTECT, related_name="clients"
    )
    prenom = models.CharField("Prenom", max_length=255)
    nom = models.CharField("Nom", max_length=255)
    telephone = models.CharField("Telephone", max_length=20, blank=True)
    ville = models.CharField("Ville", max_length=100, blank=True)
    quartier = models.CharField("Quartier", max_length=100, blank=True)
    statut_carte = models.CharField(
        "Statut de la carte",
        max_length=10,
        choices=StatutCarte.choices,
        default=StatutCarte.VENDUE,
    )
    piece_identite = models.CharField(
        "Piece d'identite", max_length=255, blank=True
    )

    class Meta:
        db_table = "client_bdm"
        ordering = ["-cree_le"]
        verbose_name = "Client"
        verbose_name_plural = "Clients"

    def __str__(self):
        return self.nom_complet

    @property
    def nom_complet(self) -> str:
        return f"{self.prenom} {self.nom}".strip()


class Vente(SaisieCommerciale):
    """Une carte vendue. C'est l'unite qui compte pour les primes."""

    campagne = models.ForeignKey(
        Campagne,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="ventes",
    )
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="ventes")
    type_carte = models.ForeignKey(
        TypeCarte, on_delete=models.PROTECT, related_name="ventes"
    )
    statut_activation = models.CharField(
        "Statut d'activation",
        max_length=10,
        choices=StatutCarte.choices,
        default=StatutCarte.VENDUE,
    )

    class Meta:
        db_table = "vente_carte"
        ordering = ["-cree_le"]
        indexes = [models.Index(fields=["campagne", "commercial"])]
        verbose_name = "Vente"
        verbose_name_plural = "Ventes"

    def __str__(self):
        return f"{self.client.nom_complet} - {self.type_carte.libelle}"


class Enrolement(SaisieCommerciale):
    """L'inscription d'un client sur l'application mobile de la banque."""

    campagne = models.ForeignKey(
        Campagne, on_delete=models.CASCADE, related_name="enrolements"
    )
    nom = models.CharField("Nom", max_length=255)
    prenom = models.CharField("Prenom", max_length=255)
    numero_compte = models.CharField("Numero de compte", max_length=50, blank=True)
    telephone = models.CharField("Telephone", max_length=20, blank=True)
    adresse = models.CharField("Adresse", max_length=255, blank=True)

    class Meta:
        db_table = "enrolement"
        ordering = ["-cree_le"]
        indexes = [models.Index(fields=["campagne", "commercial"])]
        verbose_name = "Enrolement"
        verbose_name_plural = "Enrolements"

    def __str__(self):
        return self.nom_complet

    @property
    def nom_complet(self) -> str:
        return f"{self.prenom} {self.nom}".strip()


class TypePieceIdentite(models.TextChoices):
    CNI = "CNI", "Carte nationale d'identite"
    PASSEPORT = "PASSEPORT", "Passeport"
    NINA = "NINA", "Carte NINA"


class AdhesionCarte(Horodate):
    """La demande d'adhesion VISA prepayee, exigee par certains partenaires.

    Elle complete la vente, elle ne s'y substitue pas : rapports, performances
    et primes continuent de compter des ventes. C'est pourquoi elle est un
    objet a part, relie a la vente, et non des champs supplementaires sur
    celle-ci — la BDM n'en a pas besoin.
    """

    vente = models.OneToOneField(
        Vente, on_delete=models.CASCADE, related_name="adhesion"
    )
    nom = models.CharField("Nom", max_length=255)
    prenoms = models.CharField("Prenoms", max_length=255)
    date_naissance = models.DateField("Date de naissance", null=True, blank=True)
    lieu_naissance = models.CharField("Lieu de naissance", max_length=191, blank=True)
    nationalite = models.CharField("Nationalite", max_length=100, blank=True)
    telephone = models.CharField("Telephone", max_length=20, blank=True)
    email = models.CharField("Adresse e-mail", max_length=191, blank=True)
    adresse = models.CharField("Adresse", max_length=255, blank=True)
    pays_residence = models.CharField("Pays de residence", max_length=100, blank=True)
    ville = models.CharField("Ville", max_length=100, blank=True)
    quartier = models.CharField("Quartier", max_length=100, blank=True)
    nom_sur_carte = models.CharField(
        "Nom grave sur la carte", max_length=100, blank=True
    )

    piece_type = models.CharField(
        "Type de piece", max_length=10, choices=TypePieceIdentite.choices, blank=True
    )
    piece_numero = models.CharField("Numero de piece", max_length=100, blank=True)
    piece_delivree_le = models.DateField("Delivree le", null=True, blank=True)
    piece_expire_le = models.DateField("Expire le", null=True, blank=True)
    piece_autorite = models.CharField("Autorite", max_length=191, blank=True)

    numero_compte = models.CharField("Numero de compte", max_length=50, blank=True)
    profession = models.CharField("Profession", max_length=191, blank=True)
    employeur = models.CharField("Employeur", max_length=191, blank=True)

    class Meta:
        db_table = "adhesion_carte"
        ordering = ["-cree_le"]
        verbose_name = "Adhesion carte"
        verbose_name_plural = "Adhesions carte"

    def __str__(self):
        return f"Adhesion {self.nom_complet}"

    @property
    def nom_complet(self) -> str:
        return f"{self.prenoms} {self.nom}".strip()


class RapportTelephonique(Horodate):
    """Le compte rendu d'un televendeur : des appels, pas des ventes terrain."""

    commercial = models.ForeignKey(
        Commercial, on_delete=models.CASCADE, related_name="rapports_telephoniques"
    )
    campagne = models.ForeignKey(
        Campagne,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="rapports_telephoniques",
    )
    date_rapport = models.DateField("Date")
    appels_emis = models.PositiveIntegerField("Appels emis", default=0)
    appels_aboutis = models.PositiveIntegerField("Appels aboutis", default=0)
    rendez_vous = models.PositiveIntegerField("Rendez-vous obtenus", default=0)
    cartes_vendues = models.PositiveIntegerField("Cartes vendues", default=0)
    commentaire = models.TextField("Commentaire", blank=True)

    class Meta:
        db_table = "rapport_telephonique"
        constraints = [
            models.UniqueConstraint(
                fields=["commercial", "date_rapport"],
                name="un_rapport_par_commercial_et_jour",
            )
        ]
        ordering = ["-date_rapport"]
        verbose_name = "Rapport telephonique"
        verbose_name_plural = "Rapports telephoniques"

    def __str__(self):
        return f"{self.commercial.nom_complet} - {self.date_rapport}"

    @property
    def taux_aboutissement(self) -> float:
        if not self.appels_emis:
            return 0.0
        return round(self.appels_aboutis / self.appels_emis * 100, 2)


class Prime(Horodate):
    """La prime d'un commercial pour une periode, avec son rang au classement."""

    commercial = models.ForeignKey(
        Commercial, on_delete=models.CASCADE, related_name="primes"
    )
    campagne = models.ForeignKey(
        Campagne,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="primes",
    )
    periode = models.CharField("Periode", max_length=7, help_text="Au format AAAA-MM.")
    montant = models.DecimalField("Montant", max_digits=12, decimal_places=0)
    rang = models.IntegerField("Rang", default=0)
    ventes_comptees = models.PositiveIntegerField("Ventes comptees", default=0)
    versee_le = models.DateField("Versee le", null=True, blank=True)

    class Meta:
        db_table = "prime"
        constraints = [
            models.UniqueConstraint(
                fields=["commercial", "periode", "campagne"],
                name="une_prime_par_commercial_et_periode",
            )
        ]
        ordering = ["periode", "rang"]
        verbose_name = "Prime"
        verbose_name_plural = "Primes"

    def __str__(self):
        return f"{self.commercial.nom_complet} - {self.periode} - {self.montant}"


class TypeReclamation(models.TextChoices):
    ACTIVATION = "ACTIVATION", "Activation"
    MOT_DE_PASSE = "MOT_DE_PASSE", "Mot de passe"
    RECHARGEMENT = "RECHARGEMENT", "Rechargement"
    AUTRE = "AUTRE", "Autre"


class StatutReclamation(models.TextChoices):
    OUVERTE = "OUVERTE", "Ouverte"
    EN_COURS = "EN_COURS", "En cours"
    RESOLUE = "RESOLUE", "Resolue"


class Reclamation(Horodate):
    client = models.ForeignKey(
        Client, on_delete=models.CASCADE, related_name="reclamations"
    )
    commercial = models.ForeignKey(
        Commercial, on_delete=models.CASCADE, related_name="reclamations"
    )
    type_reclamation = models.CharField(
        "Type", max_length=12, choices=TypeReclamation.choices
    )
    statut = models.CharField(
        "Statut",
        max_length=10,
        choices=StatutReclamation.choices,
        default=StatutReclamation.OUVERTE,
    )
    description = models.TextField("Description", blank=True)
    resolue_le = models.DateTimeField("Resolue le", null=True, blank=True)

    class Meta:
        db_table = "reclamation"
        ordering = ["-cree_le"]
        verbose_name = "Reclamation"
        verbose_name_plural = "Reclamations"

    def __str__(self):
        return f"{self.get_type_reclamation_display()} - {self.client.nom_complet}"

    def save(self, *args, **kwargs):
        # La date de resolution suit le statut : les tenir separes produisait
        # des reclamations resolues sans date, et des dates sans resolution.
        if self.statut == StatutReclamation.RESOLUE and not self.resolue_le:
            self.resolue_le = timezone.now()
        elif self.statut != StatutReclamation.RESOLUE:
            self.resolue_le = None
        super().save(*args, **kwargs)
