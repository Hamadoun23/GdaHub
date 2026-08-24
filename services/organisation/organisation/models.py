"""Modeles du domaine Organisation.

Origine du code repris : FinanceRH/backend/accounts (Django 6 + DRF), en
production sur rh.gdamali.net.

Ce service est le proprietaire unique de la notion d'employe.

C'est l'arbitrage le plus lourd de tout l'ERP, et il est rendu ici : quatre
applications d'origine tenaient chacune sa liste d'agents, avec des champs et
des cycles de vie differents. Une seule doit rester. Organisation tient
l'annuaire, le rattachement hierarchique et les departements ; les autres
services stockent un `agent_id` nu et le nom qu'ils affichent, fige au moment
de l'enregistrement.

**Ce qui change par rapport a l'application d'origine.** FinanceRH faisait du
compte de connexion et de la fiche agent un seul objet : `accounts.Utilisateur`
heritait d'`AbstractUser` et portait a la fois le mot de passe et la date
d'embauche. Ici les deux sont separes :

- le **compte** vit dans identity — identifiant, mot de passe, habilitations ;
- la **fiche agent** vit ici — matricule, poste, departement, rattachement.

La consequence la plus visible : le champ `role` a disparu de la fiche. Le
role n'est plus une propriete de la personne mais de son habilitation sur une
application donnee ; le meme agent peut etre « direction » sur les conges et
« commercial » sur les campagnes, ce qu'un champ unique ne savait pas dire.

Ce qui reste ici, en revanche, c'est le **rattachement hierarchique**. Ce
n'est pas un libelle d'annuaire : c'est lui qui designe le premier valideur de
chaque demande, dans tous les domaines. Il appartient a l'organigramme, pas
aux habilitations.
"""

import re

from django.conf import settings
from django.db import models
from django.utils import timezone

#: Un matricule bien forme : des lettres, puis des chiffres. « GDA0007 ».
FORME_MATRICULE = re.compile(r"^([A-Za-z]+)(\d+)$")


def prochain_matricule() -> str:
    """Le premier numero libre, dans la continuite de ceux deja attribues.

    Le prefixe n'est pas configure : il se lit de l'effectif existant. Une
    entreprise qui numerote « GDA0001 » veut que le deux-centieme agent
    s'appelle « GDA0200 », pas « AG0200 » parce qu'un reglage a ete oublie au
    deploiement.
    """
    prefixes: dict[str, int] = {}
    dernier = 0
    largeur = 4

    for matricule in Agent.objects.values_list("matricule", flat=True):
        forme = FORME_MATRICULE.match(matricule or "")
        if not forme:
            continue
        prefixe, numero = forme.group(1).upper(), forme.group(2)
        prefixes[prefixe] = prefixes.get(prefixe, 0) + 1
        dernier = max(dernier, int(numero))
        largeur = max(largeur, len(numero))

    if prefixes:
        # Le prefixe majoritaire : un import mal formé ne doit pas imposer sa
        # convention au reste de l'effectif.
        prefixe = max(prefixes, key=lambda cle: prefixes[cle])
    else:
        prefixe = getattr(settings, "GDAHUB_PREFIXE_MATRICULE", "AG")

    return f"{prefixe}{dernier + 1:0{largeur}d}"


class TypeContrat(models.TextChoices):
    CDI = "CDI", "CDI"
    CDD = "CDD", "CDD"
    STAGE = "STAGE", "Stage"
    PRESTATAIRE = "PRESTATAIRE", "Prestataire"


class MotifSortie(models.TextChoices):
    DEMISSION = "DEMISSION", "Demission"
    LICENCIEMENT = "LICENCIEMENT", "Licenciement"
    FIN_CONTRAT = "FIN_CONTRAT", "Fin de contrat"
    RETRAITE = "RETRAITE", "Retraite"
    AUTRE = "AUTRE", "Autre"


class Horodate(models.Model):
    """Dates de creation et de derniere modification, sur tous les modeles."""

    cree_le = models.DateTimeField("Cree le", auto_now_add=True)
    modifie_le = models.DateTimeField("Modifie le", auto_now=True)

    class Meta:
        abstract = True


class Departement(Horodate):
    """Une unite de l'organigramme.

    Le responsable est un agent, pas un role : c'est une personne nommee, et
    c'est a elle que remontent les demandes de son equipe.
    """

    code = models.CharField("Code", max_length=12, unique=True)
    nom = models.CharField("Nom", max_length=120)
    responsable = models.ForeignKey(
        "organisation.Agent",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="departements_diriges",
        verbose_name="Responsable",
    )
    actif = models.BooleanField("Departement actif", default=True)

    class Meta:
        db_table = "departement"
        ordering = ["nom"]
        verbose_name = "Departement"
        verbose_name_plural = "Departements"

    def __str__(self):
        return f"{self.code} - {self.nom}"

    @property
    def effectif(self) -> int:
        return self.agents.filter(actif=True).count()


class Agent(Horodate):
    """La fiche d'une personne qui travaille dans le groupe.

    Un agent n'a pas forcement de compte : un prestataire peut figurer a
    l'organigramme sans jamais se connecter. C'est pourquoi `compte_id` est
    facultatif.
    """

    #: Identifiant de connexion du compte correspondant chez identity.
    #: Renseigne a l'import, il sert de cle de rapprochement.
    identifiant = models.CharField(
        "Identifiant de connexion",
        max_length=150,
        unique=True,
        help_text="Le meme que dans identity : e-mail professionnel le plus souvent.",
    )
    #: Cle etrangere logique vers identity — jamais une vraie FK, identity
    #: vivant dans une autre base. Elle se remplit toute seule a la premiere
    #: connexion de l'interesse (voir `services.rapprocher_compte`), ce qui
    #: evite d'inventer une authentification de service pour un appariement.
    compte_id = models.PositiveBigIntegerField(
        "Compte identity",
        null=True,
        blank=True,
        unique=True,
        db_index=True,
    )

    matricule = models.CharField("Matricule", max_length=20, unique=True, blank=True)
    prenom = models.CharField("Prenom", max_length=100, blank=True)
    nom = models.CharField("Nom", max_length=100)
    email = models.EmailField("Adresse professionnelle", blank=True)
    telephone = models.CharField("Telephone", max_length=30, blank=True)

    poste = models.CharField("Poste", max_length=120, blank=True)
    departement = models.ForeignKey(
        Departement,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="agents",
        verbose_name="Departement",
    )
    responsable = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="equipe",
        verbose_name="Responsable direct",
        help_text="Designe le premier valideur des demandes de cet agent.",
    )

    type_contrat = models.CharField(
        "Type de contrat",
        max_length=15,
        choices=TypeContrat.choices,
        default=TypeContrat.CDI,
    )
    date_embauche = models.DateField("Date d'embauche", null=True, blank=True)
    date_sortie = models.DateField("Date de sortie", null=True, blank=True)
    motif_sortie = models.CharField(
        "Motif de sortie", max_length=15, choices=MotifSortie.choices, blank=True
    )

    actif = models.BooleanField("Agent en poste", default=True)

    class Meta:
        db_table = "agent"
        ordering = ["nom", "prenom"]
        verbose_name = "Agent"
        verbose_name_plural = "Agents"
        indexes = [models.Index(fields=["actif", "departement"])]

    def __str__(self):
        return f"{self.nom_complet} ({self.matricule})"

    def save(self, *args, **kwargs):
        """Attribue un matricule a la creation, puis ecrit.

        L'application d'origine composait ce matricule avec l'horodatage a la
        seconde. Deux agents saisis dans la meme seconde — un import, deux
        onglets ouverts — recevaient alors le meme, et l'ecriture echouait sur
        la contrainte d'unicite. On prend donc la suite de la numerotation
        existante, ce qui a l'avantage de produire des matricules lisibles et
        continus avec ceux de l'import.

        La boucle couvre la course entre deux ecritures simultanees : le
        numero calcule peut avoir ete pris entre-temps, on repasse au suivant.
        """
        if self.matricule:
            return super().save(*args, **kwargs)

        from django.db import IntegrityError, transaction

        for _ in range(5):
            self.matricule = prochain_matricule()
            try:
                with transaction.atomic():
                    return super().save(*args, **kwargs)
            except IntegrityError:
                # Une insertion concurrente a pris ce numero : on recommence.
                # Les arguments de sauvegarde partielle ne valent que pour une
                # mise a jour, jamais pour cette premiere insertion.
                continue

        raise IntegrityError(
            "Impossible d'attribuer un matricule libre apres cinq tentatives."
        )

    @property
    def nom_complet(self) -> str:
        return f"{self.prenom} {self.nom}".strip() or self.identifiant

    @property
    def anciennete_mois(self) -> int:
        if not self.date_embauche:
            return 0
        fin = self.date_sortie or timezone.localdate()
        return (fin.year - self.date_embauche.year) * 12 + (
            fin.month - self.date_embauche.month
        )

    @property
    def est_encadrant(self) -> bool:
        """Des agents lui sont rattaches : il valide leurs demandes.

        L'encadrement se lit de l'organigramme et jamais d'un role : c'est ce
        qui evite de maintenir un profil « chef » en double de la realite du
        rattachement.
        """
        return self.equipe.filter(actif=True).exists()

    def instantane(self) -> dict:
        """Les champs que les autres services recopient chez eux.

        Ils ne gardent que ces valeurs et ce qu'ils affichent. Un service qui
        a besoin d'autre chose passe par l'API : c'est la garantie que
        l'annuaire ne se duplique pas en silence.

        `compte_id` figure ici parce que tout l'ERP en depend pour router une
        decision : une etape de validation vise une personne *connectee*, pas
        une ligne d'annuaire. Il vaut `None` pour un agent sans compte, et
        l'etape retombe alors sur le role.
        """
        return {
            "agent_id": self.pk,
            "compte_id": self.compte_id,
            # L'identifiant de connexion est la seule cle qui traverse tout
            # l'ERP sans traduction : les numeros de compte et d'agent vivent
            # dans des bases differentes, celui-ci est le meme partout.
            "identifiant": self.identifiant,
            "matricule": self.matricule,
            "nom_complet": self.nom_complet,
            "poste": self.poste,
            "departement_id": self.departement_id,
            "departement_nom": self.departement.nom if self.departement else "",
        }

    def contexte(self) -> dict:
        """L'instantane du demandeur, son responsable compris.

        C'est la forme dont les autres services ont besoin au moment ou un
        document est cree : ils recopient tout cela une fois pour toutes, et
        n'ont plus jamais a interroger l'annuaire — ni pour afficher une
        liste, ni pour savoir a qui remonte une demande.

        Le responsable est celui du departement du demandeur, a defaut son
        rattachement direct. C'est la regle de l'application d'origine, et
        elle a une raison : le responsable d'un departement connait la charge
        de son equipe, ce qu'un rattachement purement nominal ne dit pas
        toujours.
        """
        responsable = self.responsable_effectif()
        return {
            **self.instantane(),
            "responsable": responsable.instantane() if responsable else None,
        }

    def responsable_effectif(self) -> "Agent | None":
        """Qui repond de cet agent : son departement d'abord, son chef ensuite.

        Un agent qui dirige lui-meme son departement ne peut pas etre son
        propre valideur : on retombe alors sur son rattachement.
        """
        chef_de_departement = (
            self.departement.responsable if self.departement_id else None
        )
        if chef_de_departement is not None and chef_de_departement.pk != self.pk:
            return chef_de_departement
        return self.responsable
