"""Regles metier des chantiers."""

from __future__ import annotations

from django.db import transaction

from chantiers.models import (
    JournalActivite,
    MiseAJourJournaliere,
    NoteAvancement,
    Projet,
)


def projets_visibles(queryset, utilisateur):
    """Les chantiers ou cette personne a quelque chose a faire.

    Un administrateur voit tout. Les autres ne voient que les chantiers ou ils
    sont affectes : un chef de chantier n'a pas a suivre les affaires des
    autres equipes, et un partenaire encore moins.
    """
    if utilisateur.est_superadmin or utilisateur.a_role("admin"):
        return queryset
    return queryset.filter(
        affectations__agent_identifiant=utilisateur.identifiant
    ).distinct()


@transaction.atomic
def enregistrer_avancement(
    tache, jour, avancement: int, commentaire: str, utilisateur
) -> MiseAJourJournaliere:
    """La saisie du jour, et la note qui l'accompagne quand ca bouge.

    Une seule saisie par tache et par jour : une deuxieme corrige la premiere
    plutot que de s'ajouter. Deux chiffres contradictoires le meme jour
    rendraient le rapport indefendable devant un client.

    La note n'est creee que si l'avancement change reellement. Une saisie qui
    confirme la veille sans rien faire avancer n'a pas besoin d'etre commentee
    dans l'historique.
    """
    precedent = tache.avancement()

    mise_a_jour, creee = MiseAJourJournaliere.objects.update_or_create(
        tache=tache,
        date_rapport=jour,
        defaults={
            "avancement": avancement,
            "commentaire": commentaire,
            "agent_identifiant": utilisateur.identifiant,
            "agent_nom": utilisateur.nom_complet or utilisateur.identifiant,
        },
    )

    if avancement != precedent:
        NoteAvancement.objects.create(
            tache=tache,
            mise_a_jour=mise_a_jour,
            avancement=avancement,
            avancement_precedent=precedent,
            corps=commentaire,
            agent_identifiant=utilisateur.identifiant,
            agent_nom=utilisateur.nom_complet or utilisateur.identifiant,
        )

    journaliser(
        utilisateur,
        "saisie_avancement" if creee else "correction_avancement",
        objet_type="Tache",
        objet_id=tache.pk,
        projet_id=tache.sous_phase.phase.projet_id,
        description=f"{tache.activite} : {precedent} -> {avancement} %",
    )
    return mise_a_jour


def journaliser(
    utilisateur,
    action: str,
    *,
    objet_type: str = "",
    objet_id: int | None = None,
    projet_id: int | None = None,
    description: str = "",
    details: dict | None = None,
    adresse_ip=None,
) -> JournalActivite:
    """Consigne un geste. Un chantier se conteste, et cela se verifie ici."""
    return JournalActivite.objects.create(
        agent_identifiant=utilisateur.identifiant,
        agent_nom=utilisateur.nom_complet or utilisateur.identifiant,
        action=action,
        objet_type=objet_type,
        objet_id=objet_id,
        projet_id=projet_id,
        description=description,
        details=details or {},
        adresse_ip=adresse_ip,
    )


def historique_de(tache) -> dict:
    """Tout ce qui s'est dit sur une tache, du plus recent au plus ancien."""
    return {
        "tache": {
            "id": tache.pk,
            "activite": tache.activite,
            "phase": tache.sous_phase.phase.nom,
            "sous_phase": tache.sous_phase.nom,
            "avancement": tache.avancement(),
        },
        "saisies": [
            {
                "id": saisie.pk,
                "date_rapport": saisie.date_rapport,
                "avancement": saisie.avancement,
                "statut": saisie.statut,
                "commentaire": saisie.commentaire,
                "agent_nom": saisie.agent_nom,
            }
            for saisie in tache.mises_a_jour.all()
        ],
        "notes": [
            {
                "id": note.pk,
                "avancement": note.avancement,
                "avancement_precedent": note.avancement_precedent,
                "corps": note.corps,
                "agent_nom": note.agent_nom,
                "cree_le": note.cree_le,
            }
            for note in tache.notes_avancement.all()
        ],
    }


def cloturer_rapport(projet: Projet, rapport) -> None:
    """Fige l'avancement du chantier au moment du rapport."""
    rapport.avancement_global = projet.avancement()
    rapport.save(update_fields=["avancement_global", "modifie_le"])
