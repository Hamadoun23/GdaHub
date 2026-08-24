"""Modeles du domaine Planning.

Origine du code repris : `ERP-GDA-Aba-4-module-/backend/apps/planning`, lui-meme
porte de l'application Gplanning.

Le domaine tient le calendrier editorial des clients de GDA :

    idee de contenu -> tournage -> publication

Les trois sont volontairement distincts. Une idee peut nourrir plusieurs
tournages, un tournage peut ne jamais donner de publication, et une
publication peut exister sans tournage — un texte, une image d'archive. Les
fondre en un seul objet obligerait a inventer des tournages fictifs.

Deux notions structurent le suivi et meritent d'etre expliquees :

- **le retard** — une echeance passee alors que rien n'a ete fait. C'est le
  seul chiffre qu'un client regarde vraiment ;
- **le jour non recommande** — chaque client a des jours ou ses publications
  ne portent pas. On ne les interdit pas, on previent : la decision reste au
  charge de clientele, qui connait le contexte.
"""

from django.db import models
from django.utils import timezone
from gdahub_common.validation.models import Horodate

#: L'ordre compte : il correspond a `date.weekday()`.
JOURS = [
    ("lundi", "Lundi"),
    ("mardi", "Mardi"),
    ("mercredi", "Mercredi"),
    ("jeudi", "Jeudi"),
    ("vendredi", "Vendredi"),
    ("samedi", "Samedi"),
    ("dimanche", "Dimanche"),
]

#: Une echeance a trois jours ou moins est « imminente » : c'est le delai
#: en dessous duquel un tournage ne se reprogramme plus sans consequence.
DELAI_IMMINENT = 3


class StatutEcheance(models.TextChoices):
    EN_ATTENTE = "EN_ATTENTE", "En attente"
    REALISE = "REALISE", "Realise"
    ANNULE = "ANNULE", "Annule"
    NON_REALISE = "NON_REALISE", "Non realise"
    REPROGRAMME = "REPROGRAMME", "Reprogramme"


#: Statuts qui appellent une reaction du charge de clientele.
STATUTS_A_TRAITER = {
    StatutEcheance.NON_REALISE,
    StatutEcheance.ANNULE,
    StatutEcheance.REPROGRAMME,
}


class TypeContenu(models.TextChoices):
    VIDEO = "VIDEO", "Video"
    IMAGE = "IMAGE", "Image"
    TEXTE = "TEXTE", "Texte"


class Client(Horodate):
    """Un client de GDA, au sens du planning editorial.

    Ce n'est pas le meme objet que le fournisseur de la finance ni que
    l'agent de l'annuaire : c'est une entreprise pour laquelle on produit du
    contenu. Le rapprocher d'un tiers financier supposerait que les deux
    listes coincident, ce qui n'est pas le cas.
    """

    nom_entreprise = models.CharField("Entreprise", max_length=255, unique=True)
    contact = models.CharField("Contact", max_length=150, blank=True)
    telephone = models.CharField("Telephone", max_length=30, blank=True)
    email = models.EmailField("Adresse e-mail", blank=True)
    #: Le compte du client, quand il consulte son propre planning.
    compte_identifiant = models.CharField(
        "Compte client",
        max_length=150,
        blank=True,
        db_index=True,
        help_text="Identifiant de connexion du contact, s'il consulte son planning.",
    )
    actif = models.BooleanField("Client actif", default=True)

    class Meta:
        db_table = "client_planning"
        ordering = ["nom_entreprise"]
        verbose_name = "Client"
        verbose_name_plural = "Clients"

    def __str__(self):
        return self.nom_entreprise

    def jour_deconseille(self, jour: str) -> bool:
        return self.regles.filter(jour=jour).exists()


class IdeeContenu(Horodate):
    """Une idee, partagee par tous les clients.

    Volontairement globale : une bonne idee de contenu se decline d'un client
    a l'autre, et la dupliquer par client obligerait a la ressaisir.
    """

    titre = models.CharField("Titre", max_length=255)
    type_contenu = models.CharField(
        "Type", max_length=6, choices=TypeContenu.choices
    )
    notes = models.TextField("Notes", blank=True)

    class Meta:
        db_table = "idee_contenu"
        ordering = ["titre"]
        verbose_name = "Idee de contenu"
        verbose_name_plural = "Idees de contenu"

    def __str__(self):
        return self.titre


class Echeance(Horodate):
    """Ce qui est commun a un tournage et a une publication.

    Les deux se suivent de la meme facon : une date, un statut, un motif quand
    le statut n'est pas celui qu'on esperait. Ecrire deux fois la meme
    mecanique aurait garanti qu'elles divergent.
    """

    date = models.DateField("Date")
    statut = models.CharField(
        "Statut",
        max_length=12,
        choices=StatutEcheance.choices,
        default=StatutEcheance.EN_ATTENTE,
    )
    description = models.TextField("Description", blank=True)
    motif_statut = models.TextField(
        "Motif",
        blank=True,
        help_text="Pourquoi cette echeance n'a pas ete tenue.",
    )

    class Meta:
        abstract = True

    @property
    def en_retard(self) -> bool:
        """L'echeance est passee et rien n'a ete fait."""
        return self.statut == StatutEcheance.EN_ATTENTE and self.date < timezone.localdate()

    @property
    def imminente(self) -> bool:
        jours = (self.date - timezone.localdate()).days
        return self.statut == StatutEcheance.EN_ATTENTE and 0 <= jours <= DELAI_IMMINENT

    @property
    def demande_une_action(self) -> bool:
        return self.statut in STATUTS_A_TRAITER


class Tournage(Echeance):
    client = models.ForeignKey(
        Client, on_delete=models.CASCADE, related_name="tournages"
    )
    idees = models.ManyToManyField(
        IdeeContenu, related_name="tournages", blank=True, verbose_name="Idees traitees"
    )

    class Meta:
        db_table = "tournage"
        ordering = ["-date"]
        indexes = [models.Index(fields=["client", "date"])]
        verbose_name = "Tournage"
        verbose_name_plural = "Tournages"

    def __str__(self):
        return f"{self.client.nom_entreprise} - {self.date}"

    def peut_etre_publie(self) -> bool:
        """Un tournage annule ou non realise ne donne pas de publication.

        Et un tournage deja publie non plus : le rattacher a une seconde
        publication ferait compter deux fois le meme travail dans le rapport
        mensuel du client.
        """
        if self.statut in {StatutEcheance.ANNULE, StatutEcheance.NON_REALISE}:
            return False
        return not self.publications.exists()


class Publication(Echeance):
    client = models.ForeignKey(
        Client, on_delete=models.CASCADE, related_name="publications"
    )
    idee = models.ForeignKey(
        IdeeContenu,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="publications",
    )
    tournage = models.ForeignKey(
        Tournage,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="publications",
        help_text="Facultatif : un texte ou une image d'archive n'en a pas.",
    )

    class Meta:
        db_table = "publication"
        ordering = ["-date"]
        indexes = [models.Index(fields=["client", "date"])]
        verbose_name = "Publication"
        verbose_name_plural = "Publications"

    def __str__(self):
        return f"{self.client.nom_entreprise} - {self.date}"

    @property
    def jour(self) -> str:
        return JOURS[self.date.weekday()][0]

    @property
    def jour_deconseille(self) -> bool:
        return self.client.jour_deconseille(self.jour)

    @property
    def avertissement(self) -> str:
        """Un avertissement, pas un refus.

        Le charge de clientele connait le contexte : une operation
        commerciale peut justifier de publier un jour habituellement creux.
        """
        if not self.jour_deconseille:
            return ""
        return (
            f"{self.jour.capitalize()} est un jour peu porteur pour les "
            f"publications de {self.client.nom_entreprise}."
        )


class ReglePublication(Horodate):
    """Un jour ou les publications de ce client portent mal."""

    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="regles")
    jour = models.CharField("Jour", max_length=10, choices=JOURS)
    motif = models.CharField("Motif", max_length=255, blank=True)

    class Meta:
        db_table = "regle_publication"
        constraints = [
            models.UniqueConstraint(
                fields=["client", "jour"], name="une_regle_par_client_et_jour"
            )
        ]
        ordering = ["client__nom_entreprise", "jour"]
        verbose_name = "Regle de publication"
        verbose_name_plural = "Regles de publication"

    def __str__(self):
        return f"{self.client.nom_entreprise} - {self.get_jour_display()}"


class RapportClient(Horodate):
    """Le bilan mensuel remis au client.

    Le contenu est fige a la generation : un rapport envoye ne doit pas
    changer parce qu'une publication a ete corrigee depuis.
    """

    client = models.ForeignKey(
        Client, on_delete=models.CASCADE, related_name="rapports"
    )
    mois = models.PositiveSmallIntegerField("Mois")
    annee = models.PositiveIntegerField("Annee")
    contenu = models.TextField("Contenu", blank=True)
    indicateurs = models.JSONField("Indicateurs", default=dict, blank=True)
    telechargements = models.IntegerField("Telechargements", default=0)
    genere_par_identifiant = models.CharField(
        "Genere par", max_length=150, blank=True
    )
    genere_par_nom = models.CharField("Nom", max_length=150, blank=True)

    class Meta:
        db_table = "rapport_client"
        constraints = [
            models.UniqueConstraint(
                fields=["client", "mois", "annee"],
                name="un_rapport_par_client_et_mois",
            )
        ]
        ordering = ["-annee", "-mois"]
        verbose_name = "Rapport client"
        verbose_name_plural = "Rapports clients"

    def __str__(self):
        return f"{self.client.nom_entreprise} - {self.mois:02d}/{self.annee}"

    def compter_telechargement(self):
        self.telechargements += 1
        self.save(update_fields=["telechargements", "modifie_le"])
