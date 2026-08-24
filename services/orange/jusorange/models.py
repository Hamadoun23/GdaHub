"""Modeles du domaine Jus d'Orange.

Origine du code repris : `DocsERP/Orange-full2/back` (Django + DRF), applications
`recolte`, `appro`, `fabrication`, `emballage`, `entrepot`, `distribution` et
`prospection`.

Le domaine suit une orange de l'arbre au client :

    cueillette -> reception -> production -> conditionnement -> vente
                     |                            |
                  stock                      bouteilles

Trois choses meritent d'etre expliquees avant de lire le detail.

**Un producteur interne n'est pas un producteur externe.** Pour nos propres
vergers on suit la cueillette ; d'un fournisseur tiers on ne voit que ce qu'il
livre. Une reception provient donc soit d'une cueillette, soit directement
d'un producteur externe — jamais des deux.

**Les quantites perdues ne se saisissent pas.** `qte_mauvais` se deduit du
total et du bon. Laisser saisir les trois garantit qu'un jour les comptes ne
tombent plus juste, et c'est sur ce chiffre que se juge la qualite d'un
producteur.

**Le stock d'oranges est un cumul, pas un compteur.** Il se recalcule depuis
les receptions plutot que de s'incrementer : un compteur qu'on incremente
finit toujours par diverger de son historique, et une correction de reception
laisserait le stock faux.
"""

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Sum
from gdahub_common.validation.models import Horodate

# ---------------------------------------------------------------------------
# Recolte
# ---------------------------------------------------------------------------


class TypeProducteur(models.TextChoices):
    INTERNE = "INTERNE", "Interne (nos vergers)"
    EXTERNE = "EXTERNE", "Externe (fournisseur)"


class Producteur(Horodate):
    nom_complet = models.CharField("Nom", max_length=100)
    type_producteur = models.CharField(
        "Type",
        max_length=10,
        choices=TypeProducteur.choices,
        default=TypeProducteur.INTERNE,
    )
    zone = models.CharField("Zone", max_length=100, blank=True)
    contact = models.CharField("Contact", max_length=30, blank=True)
    adresse = models.TextField("Adresse", blank=True)
    actif = models.BooleanField("Producteur actif", default=True)

    class Meta:
        db_table = "producteur"
        ordering = ["nom_complet"]
        verbose_name = "Producteur"
        verbose_name_plural = "Producteurs"

    def __str__(self):
        return self.nom_complet


class Cueillette(Horodate):
    """Une recolte sur nos propres vergers.

    Le producteur est conserve en `SET_NULL` avec son nom archive : une
    cueillette est un fait, elle ne disparait pas parce qu'on cesse de
    travailler avec quelqu'un.
    """

    producteur = models.ForeignKey(
        Producteur,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="cueillettes",
    )
    producteur_nom = models.CharField(
        "Nom du producteur", max_length=100, blank=True
    )
    date_cueillette = models.DateField("Date")
    quantite_totale = models.FloatField("Quantite totale (kg)")
    quantite_bonne = models.FloatField("Quantite bonne (kg)")
    quantite_mauvaise = models.FloatField(
        "Quantite perdue (kg)", editable=False, default=0
    )
    observation = models.TextField("Observation", blank=True)

    class Meta:
        db_table = "cueillette"
        ordering = ["-date_cueillette"]
        verbose_name = "Cueillette"
        verbose_name_plural = "Cueillettes"

    def __str__(self):
        return f"{self.producteur_affiche} - {self.date_cueillette} - {self.quantite_totale} kg"

    def save(self, *args, **kwargs):
        # La perte se deduit, elle ne se saisit pas : c'est sur ce chiffre que
        # se juge la qualite d'un producteur.
        self.quantite_mauvaise = max(self.quantite_totale - self.quantite_bonne, 0)
        if self.producteur and not self.producteur_nom:
            self.producteur_nom = self.producteur.nom_complet
        super().save(*args, **kwargs)

    @property
    def producteur_affiche(self) -> str:
        if self.producteur:
            return self.producteur.nom_complet
        return f"{self.producteur_nom} (retire)" if self.producteur_nom else "Inconnu"

    @property
    def taux_qualite(self) -> float:
        if not self.quantite_totale:
            return 0.0
        return round(self.quantite_bonne / self.quantite_totale * 100, 2)


# ---------------------------------------------------------------------------
# Approvisionnement et stock
# ---------------------------------------------------------------------------


class TypeArticle(models.TextChoices):
    BOUTEILLE_33 = "BOUTEILLE_33", "Bouteille vide 33 cl"
    BOUTEILLE_1L = "BOUTEILLE_1L", "Bouteille vide 1 L"
    PREFORME_33 = "PREFORME_33", "Preforme 33 cl"
    PREFORME_1L = "PREFORME_1L", "Preforme 1 L"
    ORANGE = "ORANGE", "Orange disponible"
    JUS_33 = "JUS_33", "Jus 33 cl"
    JUS_1L = "JUS_1L", "Jus 1 L"


class ArticleStock(Horodate):
    """Un type d'article, et sa quantite en stock.

    Un seul enregistrement par type : c'est un compteur de stock, pas un
    catalogue.
    """

    type_article = models.CharField(
        "Type", max_length=20, choices=TypeArticle.choices, unique=True
    )
    quantite = models.FloatField("Quantite", default=0)
    seuil_alerte = models.FloatField("Seuil d'alerte", default=0)
    prix_33cl = models.FloatField("Prix 33 cl (XOF)", null=True, blank=True)
    prix_1l = models.FloatField("Prix 1 L (XOF)", null=True, blank=True)

    class Meta:
        db_table = "article_stock"
        ordering = ["type_article"]
        verbose_name = "Article en stock"
        verbose_name_plural = "Articles en stock"

    def __str__(self):
        return f"{self.get_type_article_display()} - {self.quantite}"

    @property
    def sous_alerte(self) -> bool:
        return self.quantite <= self.seuil_alerte


class Reception(Horodate):
    """L'arrivee des oranges a l'usine.

    Elle vient d'une cueillette (producteur interne) ou directement d'un
    producteur externe. Les deux a la fois n'a pas de sens : on refuse plutot
    que de laisser deux origines contradictoires sur la meme ligne.
    """

    cueillette = models.ForeignKey(
        Cueillette,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="receptions",
    )
    cueillette_archive = models.CharField(
        "Cueillette archivee", max_length=250, blank=True
    )
    producteur_externe = models.ForeignKey(
        Producteur,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="receptions_directes",
        verbose_name="Producteur externe",
    )
    numero = models.CharField("Numero", max_length=30, blank=True, editable=False)
    date_reception = models.DateField("Date")
    quantite_recue = models.FloatField("Quantite recue (kg)")
    quantite_bonne = models.FloatField("Quantite bonne (kg)")
    quantite_mauvaise = models.FloatField(
        "Quantite perdue (kg)", editable=False, default=0
    )
    lieu_depot = models.CharField("Lieu de depot", max_length=100, blank=True)
    cause_perte = models.TextField("Cause de la perte", blank=True)

    class Meta:
        db_table = "reception"
        ordering = ["-date_reception"]
        verbose_name = "Reception"
        verbose_name_plural = "Receptions"

    def __str__(self):
        return f"{self.numero} - {self.date_reception}"

    def save(self, *args, **kwargs):
        self.quantite_mauvaise = max(self.quantite_recue - self.quantite_bonne, 0)
        if not self.numero:
            self.numero = numero_du_jour(
                Reception, "date_reception", self.date_reception, "R", "JGDA"
            )
        super().save(*args, **kwargs)

    @property
    def origine(self) -> str:
        if self.cueillette:
            return str(self.cueillette)
        if self.producteur_externe:
            return f"{self.producteur_externe.nom_complet} (externe)"
        if self.cueillette_archive:
            return f"{self.cueillette_archive} (supprimee)"
        return "Origine non renseignee"

    @property
    def taux_qualite(self) -> float:
        if not self.quantite_recue:
            return 0.0
        return round(self.quantite_bonne / self.quantite_recue * 100, 2)

    @property
    def etat_qualite(self) -> str:
        taux = self.taux_qualite
        if taux >= 80:
            return "EXCELLENT"
        if taux >= 50:
            return "BON"
        return "MAUVAIS"


def numero_du_jour(modele, champ_date, jour, prefixe: str, milieu: str = "") -> str:
    """Un numero remis a zero chaque jour : « R001JGDA12022026 ».

    C'est la convention de l'application d'origine, et les opérateurs la
    lisent a voix haute au telephone : la changer leur couterait plus que ce
    qu'un compteur global rapporterait.
    """
    rang = modele.objects.filter(**{champ_date: jour}).count() + 1
    return f"{prefixe}{rang:03d}{milieu}{jour.strftime('%d%m%Y')}"


def recalculer_stock_oranges() -> float:
    """Le stock d'oranges, recalcule depuis les receptions.

    Un compteur qu'on incremente finit par diverger de son historique : une
    reception corrigee laisserait le stock faux, et personne ne s'en
    apercevrait avant l'inventaire.
    """
    total = Reception.objects.aggregate(total=Sum("quantite_bonne"))["total"] or 0
    article, _ = ArticleStock.objects.get_or_create(
        type_article=TypeArticle.ORANGE, defaults={"seuil_alerte": 100}
    )
    article.quantite = total
    article.save(update_fields=["quantite", "modifie_le"])
    return total


# ---------------------------------------------------------------------------
# Fabrication
# ---------------------------------------------------------------------------


class Recette(models.TextChoices):
    R80_20 = "R80_20", "80/20"
    R75_25 = "R75_25", "75/25"


class TestQualite(models.TextChoices):
    CONFORME = "CONFORME", "Conforme"
    NON_CONFORME = "NON_CONFORME", "Non conforme"


class StatutProduction(models.TextChoices):
    EN_COURS = "EN_COURS", "En cours"
    TERMINEE = "TERMINEE", "Terminee"
    ANNULEE = "ANNULEE", "Annulee"


class Production(Horodate):
    """Un ordre de fabrication, avec ses controles.

    Les cases a cocher — lavage, filtration, pasteurisation — ne sont pas
    decoratives : ce sont les points de controle sanitaire, et c'est cette
    ligne qu'on ressort en cas de reclamation sur un lot.
    """

    date_production = models.DateField("Date")
    numero = models.CharField("Numero d'OF", max_length=30, blank=True, editable=False)
    lavage_effectue = models.BooleanField("Lavage effectue", default=False)
    filtration_effectuee = models.BooleanField("Filtration effectuee", default=False)
    recette = models.CharField("Recette", max_length=10, choices=Recette.choices)
    eau_ajoutee_l = models.FloatField("Eau ajoutee (L)", default=0)
    sucre_ajoute_kg = models.FloatField("Sucre ajoute (kg)", default=0)
    sorbate_ajoute_g = models.FloatField("Sorbate ajoute (g)", default=0)
    pasteurisation_80c = models.BooleanField("Pasteurisation 80 C", default=False)
    test_qualite = models.CharField(
        "Test qualite", max_length=15, choices=TestQualite.choices, blank=True
    )
    ph = models.IntegerField(
        "pH",
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(10)],
    )
    refractometre = models.IntegerField(
        "Refractometre",
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(20)],
    )
    volume_final_l = models.FloatField("Volume final (L)", default=0)
    statut = models.CharField(
        "Statut",
        max_length=10,
        choices=StatutProduction.choices,
        default=StatutProduction.EN_COURS,
    )
    agent_identifiant = models.CharField("Responsable", max_length=150, blank=True)
    agent_nom = models.CharField("Nom", max_length=150, blank=True)

    class Meta:
        db_table = "production"
        ordering = ["-date_production"]
        verbose_name = "Production"
        verbose_name_plural = "Productions"

    def __str__(self):
        return f"{self.numero} - {self.date_production}"

    def save(self, *args, **kwargs):
        if not self.numero:
            self.numero = numero_du_jour(
                Production, "date_production", self.date_production, "OF"
            )
        super().save(*args, **kwargs)

    @property
    def controles_complets(self) -> bool:
        """Les trois points de controle sanitaire ont-ils ete faits ?"""
        return all(
            (self.lavage_effectue, self.filtration_effectuee, self.pasteurisation_80c)
        )


# ---------------------------------------------------------------------------
# Conditionnement
# ---------------------------------------------------------------------------


class StatutBouteille(models.TextChoices):
    DISPONIBLE = "DISPONIBLE", "Disponible"
    VENDUE = "VENDUE", "Vendue"
    PERIMEE = "PERIMEE", "Perimee"
    REBUT = "REBUT", "Rebut"


class Conditionnement(Horodate):
    """La mise en bouteille d'une production."""

    date_conditionnement = models.DateField("Date")
    numero = models.CharField("Numero", max_length=30, blank=True, editable=False)
    quantite_33cl = models.IntegerField("Bouteilles 33 cl", default=0)
    quantite_1l = models.IntegerField("Bouteilles 1 L", default=0)
    production = models.ForeignKey(
        Production,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="conditionnements",
    )
    agent_identifiant = models.CharField("Responsable", max_length=150, blank=True)
    agent_nom = models.CharField("Nom", max_length=150, blank=True)

    class Meta:
        db_table = "conditionnement"
        ordering = ["-date_conditionnement"]
        verbose_name = "Conditionnement"
        verbose_name_plural = "Conditionnements"

    def __str__(self):
        return f"{self.numero} - {self.date_conditionnement}"

    def save(self, *args, **kwargs):
        if not self.numero:
            self.numero = numero_du_jour(
                Conditionnement,
                "date_conditionnement",
                self.date_conditionnement,
                "COND",
            )
        super().save(*args, **kwargs)


class Bouteille(Horodate):
    """Une bouteille physique, tracee de la production a la vente.

    C'est la maille qui permet de rappeler un lot : sans elle, une DLC
    depassee obligerait a retirer toute la production du mois.
    """

    conditionnement = models.ForeignKey(
        Conditionnement, on_delete=models.CASCADE, related_name="bouteilles"
    )
    format_litre = models.BooleanField(
        "Format 1 L", default=False, help_text="Faux = 33 cl."
    )
    code_barre = models.CharField("Code-barres", max_length=100, blank=True)
    date_limite = models.DateField("Date limite de consommation")
    statut = models.CharField(
        "Statut",
        max_length=12,
        choices=StatutBouteille.choices,
        default=StatutBouteille.DISPONIBLE,
    )
    commande = models.ForeignKey(
        "jusorange.Commande",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="bouteilles",
    )

    class Meta:
        db_table = "bouteille"
        ordering = ["-cree_le"]
        indexes = [models.Index(fields=["statut", "date_limite"])]
        verbose_name = "Bouteille"
        verbose_name_plural = "Bouteilles"

    def __str__(self):
        return f"{self.code_barre or self.pk} - {self.format_affiche} - {self.statut}"

    @property
    def format_affiche(self) -> str:
        return "1 L" if self.format_litre else "33 cl"


# ---------------------------------------------------------------------------
# Entrepot
# ---------------------------------------------------------------------------


class StatutInventaire(models.TextChoices):
    EN_COURS = "EN_COURS", "En cours"
    TERMINE = "TERMINE", "Termine"
    BLOQUE = "BLOQUE", "Bloque"


class QualiteInventaire(models.TextChoices):
    BON = "BON", "Bon"
    MOYEN = "MOYEN", "Moyen"
    MAUVAIS = "MAUVAIS", "Mauvais"


class Inventaire(Horodate):
    """Le comptage physique d'un article, confronte au stock theorique.

    L'ecart et sa gravite se calculent : les laisser saisir permettrait de
    qualifier de « bon » un inventaire qui ne l'est pas, et c'est precisement
    ce que l'inventaire sert a detecter.
    """

    article = models.ForeignKey(
        ArticleStock, on_delete=models.CASCADE, related_name="inventaires"
    )
    date_inventaire = models.DateField("Date")
    quantite_systeme = models.FloatField("Quantite en systeme", default=0)
    quantite_depot = models.FloatField("Quantite comptee", default=0)
    ecart = models.FloatField("Ecart", default=0, editable=False)
    statut = models.CharField(
        "Statut",
        max_length=10,
        choices=StatutInventaire.choices,
        default=StatutInventaire.EN_COURS,
    )
    qualite = models.CharField(
        "Qualite",
        max_length=8,
        choices=QualiteInventaire.choices,
        default=QualiteInventaire.BON,
        editable=False,
    )
    observation = models.TextField("Observation", blank=True)
    agent_identifiant = models.CharField("Responsable", max_length=150, blank=True)
    agent_nom = models.CharField("Nom", max_length=150, blank=True)

    class Meta:
        db_table = "inventaire"
        ordering = ["-date_inventaire"]
        verbose_name = "Inventaire"
        verbose_name_plural = "Inventaires"

    def __str__(self):
        return f"{self.article.get_type_article_display()} - {self.date_inventaire}"

    def save(self, *args, **kwargs):
        self.ecart = self.quantite_depot - self.quantite_systeme
        self.qualite = self.qualifier()
        super().save(*args, **kwargs)

    def qualifier(self) -> str:
        """Un ecart se juge en proportion, pas en valeur absolue.

        Cinq kilos d'ecart sur une tonne d'oranges n'ont pas le meme sens que
        cinq kilos sur dix.
        """
        if self.quantite_systeme > 0:
            proportion = abs(self.ecart) / self.quantite_systeme * 100
            seuils = (5, 15)
        else:
            proportion = abs(self.ecart)
            seuils = (5, 20)
        if proportion <= seuils[0]:
            return QualiteInventaire.BON
        if proportion <= seuils[1]:
            return QualiteInventaire.MOYEN
        return QualiteInventaire.MAUVAIS


# ---------------------------------------------------------------------------
# Distribution
# ---------------------------------------------------------------------------


class ModeVente(models.TextChoices):
    ACHAT_VENTE = "ACHAT_VENTE", "Achat-vente"
    PARTIELLE = "PARTIELLE", "Partielle"
    DEPOT_VENTE = "DEPOT_VENTE", "Depot-vente"


class StatutFacture(models.TextChoices):
    EMISE = "EMISE", "Emise"
    SOLDEE = "SOLDEE", "Soldee"
    PARTIELLE = "PARTIELLE", "Partiellement reglee"
    ANNULEE = "ANNULEE", "Annulee"


class ModePaiement(models.TextChoices):
    ESPECE = "ESPECE", "Espece"
    CHEQUE = "CHEQUE", "Cheque"
    VIREMENT = "VIREMENT", "Virement"
    MOBILE = "MOBILE", "Mobile money"


class StatutReception(models.TextChoices):
    CONFORME = "CONFORME", "Conforme"
    ECART_POSITIF = "ECART_POSITIF", "Ecart positif (recu superieur au declare)"
    ECART_NEGATIF = "ECART_NEGATIF", "Ecart negatif (recu inferieur au declare)"


class ClientJus(Horodate):
    """Un acheteur de jus. Distinct du client du planning editorial."""

    nom_complet = models.CharField("Nom", max_length=200)
    telephone = models.CharField("Telephone", max_length=30, blank=True)
    email = models.EmailField("Adresse e-mail", blank=True)
    adresse = models.TextField("Adresse", blank=True)
    actif = models.BooleanField("Client actif", default=True)

    class Meta:
        db_table = "client_jus"
        ordering = ["nom_complet"]
        verbose_name = "Client"
        verbose_name_plural = "Clients"

    def __str__(self):
        return self.nom_complet


class Vente(Horodate):
    client = models.ForeignKey(
        ClientJus, on_delete=models.CASCADE, related_name="ventes"
    )
    date_vente = models.DateField("Date")
    montant_total = models.FloatField("Montant total", default=0)
    mode = models.CharField(
        "Mode", max_length=12, choices=ModeVente.choices, default=ModeVente.ACHAT_VENTE
    )

    class Meta:
        db_table = "vente"
        ordering = ["-date_vente"]
        verbose_name = "Vente"
        verbose_name_plural = "Ventes"

    def __str__(self):
        return f"{self.client.nom_complet} - {self.date_vente}"

    @property
    def montant_regle(self) -> float:
        total = 0.0
        for facture in self.factures.all():
            total += facture.montant_regle
        return total

    @property
    def reste_a_payer(self) -> float:
        return max(self.montant_total - self.montant_regle, 0)


class Commande(Horodate):
    client = models.ForeignKey(
        ClientJus, on_delete=models.CASCADE, related_name="commandes"
    )
    vente = models.ForeignKey(
        Vente,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="commandes",
    )
    date_commande = models.DateField("Date")
    quantite_33cl = models.IntegerField("Quantite 33 cl", default=0)
    quantite_1l = models.IntegerField("Quantite 1 L", default=0)
    observation = models.TextField("Observation", blank=True)

    class Meta:
        db_table = "commande"
        ordering = ["-date_commande"]
        verbose_name = "Commande"
        verbose_name_plural = "Commandes"

    def __str__(self):
        return f"{self.client.nom_complet} - {self.date_commande}"


class Facture(Horodate):
    vente = models.ForeignKey(
        Vente, on_delete=models.CASCADE, related_name="factures"
    )
    numero = models.CharField("Numero", max_length=50, blank=True, editable=False)
    date_facture = models.DateField("Date")
    montant = models.FloatField("Montant")
    statut = models.CharField(
        "Statut",
        max_length=10,
        choices=StatutFacture.choices,
        default=StatutFacture.EMISE,
    )
    date_echeance = models.DateField("Echeance")

    class Meta:
        db_table = "facture"
        ordering = ["-date_facture"]
        verbose_name = "Facture"
        verbose_name_plural = "Factures"

    def __str__(self):
        return f"{self.numero} - {self.montant}"

    def save(self, *args, **kwargs):
        if not self.numero:
            self.numero = numero_du_jour(
                Facture, "date_facture", self.date_facture, "FA"
            )
        super().save(*args, **kwargs)

    @property
    def montant_regle(self) -> float:
        return self.paiements.aggregate(total=Sum("montant"))["total"] or 0.0

    @property
    def reste_a_payer(self) -> float:
        return max(self.montant - self.montant_regle, 0)

    def statut_deduit(self) -> str:
        """Le statut suit les paiements, il ne se declare pas.

        Une facture marquee soldee alors qu'il reste 50 000 francs a
        encaisser est une creance qui disparait des relances.
        """
        if self.statut == StatutFacture.ANNULEE:
            return StatutFacture.ANNULEE
        regle = self.montant_regle
        if regle <= 0:
            return StatutFacture.EMISE
        if regle >= self.montant:
            return StatutFacture.SOLDEE
        return StatutFacture.PARTIELLE


class Paiement(Horodate):
    facture = models.ForeignKey(
        Facture, on_delete=models.CASCADE, related_name="paiements"
    )
    date_paiement = models.DateField("Date")
    montant = models.FloatField("Montant")
    mode = models.CharField("Mode", max_length=10, choices=ModePaiement.choices)
    reference = models.CharField("Reference", max_length=100, blank=True)

    class Meta:
        db_table = "paiement"
        ordering = ["-date_paiement"]
        verbose_name = "Paiement"
        verbose_name_plural = "Paiements"

    def __str__(self):
        return f"{self.facture.numero} - {self.montant}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Le statut de la facture suit ses paiements, immediatement.
        facture = self.facture
        nouveau = facture.statut_deduit()
        if nouveau != facture.statut:
            facture.statut = nouveau
            facture.save(update_fields=["statut", "modifie_le"])


class ReceptionPaiement(Horodate):
    """Ce que la tresorerie a reellement recu.

    Le commercial declare un encaissement, la tresorerie constate. L'ecart
    entre les deux est le point de controle du domaine : sans lui, un
    manquant se noierait dans les comptes.
    """

    paiement = models.OneToOneField(
        Paiement, on_delete=models.CASCADE, related_name="reception"
    )
    montant_recu = models.FloatField("Montant recu")
    date_reception = models.DateField("Date")
    statut = models.CharField(
        "Statut",
        max_length=14,
        choices=StatutReception.choices,
        default=StatutReception.CONFORME,
        editable=False,
    )
    observation = models.TextField("Observation", blank=True)
    ecart_traite = models.BooleanField("Ecart traite", default=False)

    class Meta:
        db_table = "reception_paiement"
        ordering = ["-date_reception"]
        verbose_name = "Reception de paiement"
        verbose_name_plural = "Receptions de paiement"

    def __str__(self):
        return f"{self.paiement} - recu {self.montant_recu}"

    def save(self, *args, **kwargs):
        self.statut = self.qualifier()
        super().save(*args, **kwargs)

    def qualifier(self) -> str:
        declare = self.paiement.montant
        if self.montant_recu > declare:
            return StatutReception.ECART_POSITIF
        if self.montant_recu < declare:
            return StatutReception.ECART_NEGATIF
        return StatutReception.CONFORME

    @property
    def ecart(self) -> float:
        return self.montant_recu - self.paiement.montant


# ---------------------------------------------------------------------------
# Prospection
# ---------------------------------------------------------------------------


class StatutProspect(models.TextChoices):
    PROSPECTE = "PROSPECTE", "Prospecte"
    INTERESSE = "INTERESSE", "Interesse"
    CLIENT = "CLIENT", "Client"
    PARTENAIRE = "PARTENAIRE", "Point de vente partenaire"
    A_RELANCER = "A_RELANCER", "A relancer"
    REFUS = "REFUS", "Non interesse"


class TypePointVente(models.TextChoices):
    BOUTIQUE = "BOUTIQUE", "Boutique"
    SUPERMARCHE = "SUPERMARCHE", "Supermarche"
    EPICERIE = "EPICERIE", "Epicerie / alimentation"
    RESTAURANT = "RESTAURANT", "Restaurant / maquis"
    HOTEL = "HOTEL", "Hotel"
    KIOSQUE = "KIOSQUE", "Kiosque"
    AUTRE = "AUTRE", "Autre"


class PointVente(Horodate):
    nom = models.CharField("Nom", max_length=200)
    type_point = models.CharField(
        "Type", max_length=12, choices=TypePointVente.choices, default=TypePointVente.BOUTIQUE
    )
    statut = models.CharField(
        "Statut",
        max_length=12,
        choices=StatutProspect.choices,
        default=StatutProspect.PROSPECTE,
    )
    zone = models.CharField("Zone", max_length=100, blank=True)
    adresse = models.TextField("Adresse", blank=True)
    contact = models.CharField("Contact", max_length=150, blank=True)
    telephone = models.CharField("Telephone", max_length=30, blank=True)
    latitude = models.FloatField("Latitude", null=True, blank=True)
    longitude = models.FloatField("Longitude", null=True, blank=True)
    client = models.ForeignKey(
        ClientJus,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="points_vente",
        help_text="Renseigne quand le prospect est devenu client.",
    )

    class Meta:
        db_table = "point_vente"
        ordering = ["nom"]
        indexes = [models.Index(fields=["statut", "zone"])]
        verbose_name = "Point de vente"
        verbose_name_plural = "Points de vente"

    def __str__(self):
        return self.nom


class Visite(Horodate):
    """Le passage d'un commercial sur un point de vente."""

    point_vente = models.ForeignKey(
        PointVente, on_delete=models.CASCADE, related_name="visites"
    )
    commercial_identifiant = models.CharField(
        "Commercial", max_length=150, blank=True, db_index=True
    )
    commercial_nom = models.CharField("Nom", max_length=150, blank=True)
    date_visite = models.DateField("Date")
    statut_apres = models.CharField(
        "Statut apres visite",
        max_length=12,
        choices=StatutProspect.choices,
        blank=True,
    )
    compte_rendu = models.TextField("Compte rendu", blank=True)
    prochaine_visite = models.DateField("Prochaine visite", null=True, blank=True)

    class Meta:
        db_table = "visite"
        ordering = ["-date_visite"]
        verbose_name = "Visite"
        verbose_name_plural = "Visites"

    def __str__(self):
        return f"{self.point_vente.nom} - {self.date_visite}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Une visite qui change le statut du prospect le met a jour : sinon le
        # commercial doit le faire deux fois, et il oublie.
        if self.statut_apres and self.point_vente.statut != self.statut_apres:
            self.point_vente.statut = self.statut_apres
            self.point_vente.save(update_fields=["statut", "modifie_le"])
