"use client";

/**
 * Module Chantiers.
 *
 * L'écran est construit autour d'un seul geste : saisir l'avancement d'une
 * tâche. Un chef de chantier le répète quinze fois par jour, et tout le reste
 * en découle — les pourcentages de phase, le rapport journalier, le chiffre
 * que regarde le client.
 */

import { useState } from "react";

import { Coquille } from "@/composants/Coquille";
import { Information } from "@/composants/metier";
import {
  Alerte,
  Badge,
  Bouton,
  Carte,
  Champ,
  Chargement,
  EnTetePage,
  EtatVide,
  Grille,
  LigneListe,
  ListeLignes,
  Modale,
  Onglets,
  Selection,
  Statistique,
  ZoneTexte,
  cx,
} from "@/composants/ui";
import { aujourdhui, date } from "@/lib/format";
import { GestionRessource } from "@/composants/ressource";
import { useAction, useListe, useRessource } from "@/lib/ressources";
import { useSession } from "@/lib/session";

import * as sections from "./sections";

type Projet = {
  id: number;
  nom: string;
  description: string;
  client: string;
  date_debut: string | null;
  date_fin: string | null;
  statut: string;
  statut_libelle: string;
  avancement: number;
  nombre_de_taches: number;
  affectations: { id: number; agent_identifiant: string; agent_nom: string }[];
};

type Tache = {
  id: number;
  activite: string;
  phase_nom: string;
  sous_phase_nom: string;
  avancement: number;
  derniere_saisie: string | null;
  masquee_partenaire: boolean;
};

type ProjetDetail = Projet & {
  avancement_par_phase: Record<string, number>;
  phases: {
    id: number;
    nom: string;
    avancement: number;
    sous_phases: { id: number; nom: string; avancement: number; taches: Tache[] }[];
  }[];
};

type TableauChantiers = {
  projets: number;
  projets_en_cours: number;
  saisies_du_jour: number;
  avancement_moyen: number;
};

export default function PageChantiers() {
  return (
    <Coquille>
      <Contenu />
    </Coquille>
  );
}

function Contenu() {
  const { profil } = useSession();
  const [onglet, setOnglet] = useState<
    "suivi" | "structure" | "photos" | "rapports" | "journal"
  >("suivi");
  const [ouvert, setOuvert] = useState<number | null>(null);
  const [saisie, setSaisie] = useState<Tache | null>(null);

  const roles = profil?.habilitations.daily ?? [];
  const peutSaisir = ["admin", "chef_chantier", "ingenieur", "controle_qualite"].some(
    (role) => roles.includes(role),
  );

  const tableau = useRessource<TableauChantiers>("/daily/tableau-de-bord");
  const projets = useListe<Projet>("/daily/projets?taille=100");
  const detail = useRessource<ProjetDetail>(
    ouvert ? `/daily/projets/${ouvert}` : null,
  );


  return (
    <>
      <EnTetePage
        titre="Chantiers"
        description="Avancement des projets, saisie journalière et rapports."
      />

      <div className="mb-6">
        <Grille colonnes={4}>
          <Statistique libelle="Chantiers suivis" valeur={tableau.donnees?.projets ?? 0} />
          <Statistique
            libelle="En cours"
            valeur={tableau.donnees?.projets_en_cours ?? 0}
            ton="alerte"
          />
          <Statistique
            libelle="Avancement moyen"
            valeur={`${tableau.donnees?.avancement_moyen ?? 0} %`}
          />
          <Statistique
            libelle="Saisies aujourd'hui"
            valeur={tableau.donnees?.saisies_du_jour ?? 0}
            ton={tableau.donnees?.saisies_du_jour ? "succes" : "alerte"}
          />
        </Grille>
      </div>

      <Onglets
        onglets={[
          { cle: "suivi" as const, libelle: "Suivi" },
          { cle: "structure" as const, libelle: "Découpage" },
          { cle: "photos" as const, libelle: "Photos" },
          { cle: "rapports" as const, libelle: "Rapports" },
          { cle: "journal" as const, libelle: "Journal" },
        ]}
        actif={onglet}
        onChange={setOnglet}
      />

      {onglet === "suivi" ? (
        <div className="space-y-6">
          <Carte sansPadding>
            <div className="px-4 sm:px-5">
              {projets.chargement ? (
                <Chargement />
              ) : projets.erreur ? (
                <div className="py-5">
                  <Alerte>{projets.erreur}</Alerte>
                </div>
              ) : !projets.donnees?.length ? (
                <EtatVide
                  titre="Aucun chantier"
                  description="Aucun chantier ne vous est affecté."
                />
              ) : (
                <ListeLignes>
                  {projets.donnees.map((projet) => (
                    <LigneListe
                      key={projet.id}
                      titre={projet.nom}
                      detail={
                        <>
                          {projet.client || "Client non renseigné"} ·{" "}
                          {projet.nombre_de_taches} tâche(s)
                          {projet.date_debut
                            ? ` · depuis le ${date(projet.date_debut)}`
                            : ""}
                        </>
                      }
                      valeur={<JaugeAvancement valeur={projet.avancement} />}
                      statut={<Badge>{projet.statut_libelle}</Badge>}
                      onClick={() => setOuvert(projet.id)}
                    />
                  ))}
                </ListeLignes>
              )}
            </div>
          </Carte>
        </div>
      ) : null}

      {onglet === "structure" ? (
        <div className="space-y-6">
          <GestionRessource spec={sections.projets(peutSaisir)} />
          <GestionRessource spec={sections.phases(peutSaisir)} />
          <GestionRessource spec={sections.sousPhases(peutSaisir)} />
          <GestionRessource spec={sections.taches(peutSaisir)} />
          <GestionRessource spec={sections.saisies()} />
        </div>
      ) : null}

      {onglet === "photos" ? <GaleriePhotos peutEcrire={peutSaisir} /> : null}

      {onglet === "rapports" ? (
        <GestionRessource spec={sections.rapports(peutSaisir)} />
      ) : null}

      {onglet === "journal" ? <GestionRessource spec={sections.journal()} /> : null}

      <Modale
        ouverte={ouvert !== null}
        titre={detail.donnees?.nom ?? "Chantier"}
        description={detail.donnees?.client}
        large
        onFermer={() => setOuvert(null)}
      >
        {detail.chargement ? (
          <Chargement />
        ) : detail.erreur ? (
          <Alerte>{detail.erreur}</Alerte>
        ) : detail.donnees ? (
          <div className="space-y-5">
            <Grille colonnes={3}>
              <Information
                libelle="Avancement"
                valeur={<JaugeAvancement valeur={detail.donnees.avancement} />}
              />
              <Information
                libelle="Période"
                valeur={`${date(detail.donnees.date_debut)} → ${date(detail.donnees.date_fin)}`}
              />
              <Information
                libelle="Équipe"
                valeur={`${detail.donnees.affectations.length} agent(s)`}
              />
            </Grille>

            {detail.donnees.phases.map((phase) => (
              <div key={phase.id}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="font-medium">{phase.nom}</p>
                  <JaugeAvancement valeur={phase.avancement} />
                </div>
                {phase.sous_phases.map((sousPhase) => (
                  <div key={sousPhase.id} className="mb-3 ml-3">
                    <p className="mb-1 text-xs uppercase tracking-wide text-ardoise-500">
                      {sousPhase.nom}
                    </p>
                    <ListeLignes>
                      {sousPhase.taches.map((tache) => (
                        <LigneListe
                          key={tache.id}
                          titre={tache.activite}
                          detail={
                            tache.derniere_saisie
                              ? `Dernière saisie : ${date(tache.derniere_saisie)}`
                              : "Jamais saisie"
                          }
                          valeur={<JaugeAvancement valeur={tache.avancement} />}
                          onClick={
                            peutSaisir
                              ? () =>
                                  setSaisie({
                                    ...tache,
                                    phase_nom: phase.nom,
                                    sous_phase_nom: sousPhase.nom,
                                  })
                              : undefined
                          }
                        />
                      ))}
                    </ListeLignes>
                  </div>
                ))}
              </div>
            ))}

            {!detail.donnees.phases.length ? (
              <EtatVide
                titre="Chantier sans découpage"
                description="Aucune phase n'a encore été définie."
              />
            ) : null}
          </div>
        ) : null}
      </Modale>

      {saisie ? (
        <FormulaireAvancement
          tache={saisie}
          onFermer={() => setSaisie(null)}
          onEnregistre={() => {
            setSaisie(null);
            void detail.recharger();
            void projets.recharger();
            void tableau.recharger();
          }}
        />
      ) : null}
    </>
  );
}

function JaugeAvancement({ valeur }: { valeur: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-ardoise-200 dark:bg-ardoise-700">
        <span
          className={cx(
            "block h-full rounded-full",
            valeur >= 100
              ? "bg-emerald-500"
              : valeur > 0
                ? "bg-marque"
                : "bg-ardoise-200 dark:bg-ardoise-700",
          )}
          style={{ width: `${Math.min(Math.max(valeur, 0), 100)}%` }}
        />
      </span>
      <span className="w-10 text-right text-xs tabular-nums">{valeur} %</span>
    </span>
  );
}

/**
 * La saisie du jour.
 *
 * Le statut n'est pas demandé : il se déduit de l'avancement côté serveur.
 * Le laisser saisir produisait des tâches « terminées » à 40 %.
 */
function FormulaireAvancement({
  tache,
  onFermer,
  onEnregistre,
}: {
  tache: Tache;
  onFermer: () => void;
  onEnregistre: () => void;
}) {
  const { requete } = useSession();
  const action = useAction();
  const [avancement, setAvancement] = useState(String(tache.avancement));
  const [jour, setJour] = useState(aujourdhui());
  const [commentaire, setCommentaire] = useState("");

  const envoyer = async (evenement: React.FormEvent) => {
    evenement.preventDefault();
    const succes = await action.executer(() =>
      requete(`/daily/taches/${tache.id}/avancement`, {
        methode: "POST",
        corps: {
          avancement: Number(avancement),
          date_rapport: jour,
          commentaire,
        },
      }),
    );
    if (succes) onEnregistre();
  };

  const bouge = Number(avancement) !== tache.avancement;

  return (
    <Modale
      ouverte
      titre={tache.activite}
      description={`${tache.phase_nom} · ${tache.sous_phase_nom}`}
      onFermer={onFermer}
    >
      <form onSubmit={envoyer} className="space-y-4">
        {action.erreur ? <Alerte>{action.erreur}</Alerte> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Champ
            libelle="Avancement (%)"
            type="number"
            min="0"
            max="100"
            step="5"
            value={avancement}
            onChange={(evenement) => setAvancement(evenement.target.value)}
            required
            aide={`Actuellement à ${tache.avancement} %`}
            erreurs={action.champs.avancement}
          />
          <Champ
            libelle="Jour"
            type="date"
            value={jour}
            onChange={(evenement) => setJour(evenement.target.value)}
            required
            erreurs={action.champs.date_rapport}
          />
        </div>

        <ZoneTexte
          libelle="Commentaire"
          value={commentaire}
          onChange={(evenement) => setCommentaire(evenement.target.value)}
          placeholder="Ce qui a été fait, ce qui bloque..."
          erreurs={action.champs.commentaire}
        />

        <p className="text-xs text-ardoise-500">
          {bouge
            ? "L'avancement change : votre commentaire sera conservé dans l'historique de la tâche."
            : "Une saisie qui confirme la veille n'ajoute pas de note à l'historique."}{" "}
          Une seule saisie par jour : une deuxième corrige la première.
        </p>

        <div className="flex justify-end gap-2 border-t border-ardoise-200 pt-4 dark:border-ardoise-700">
          <Bouton type="button" variante="secondaire" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton type="submit" chargement={action.enCours}>
            Enregistrer
          </Bouton>
        </div>
      </form>
    </Modale>
  );
}

/**
 * La galerie du chantier.
 *
 * Ecrite a la main, parce qu'une photo n'est pas un champ de formulaire : on la
 * regarde. Le classement avant / pendant / apres est ce qui rend une reserve
 * opposable au client — d'ou le filtre en tete.
 */
function GaleriePhotos({ peutEcrire }: { peutEcrire: boolean }) {
  const { requete } = useSession();
  const action = useAction();
  const [projet, setProjet] = useState("");
  const [categorie, setCategorie] = useState("");
  const [ajout, setAjout] = useState(false);

  const projets = useListe<{ id: number; nom: string }>("/daily/projets?taille=100");
  const parametres = [
    projet ? `projet=${projet}` : "",
    categorie ? `categorie=${categorie}` : "",
    "taille=60",
  ]
    .filter(Boolean)
    .join("&");
  const photos = useListe<{
    id: number;
    projet: number;
    categorie: string;
    categorie_libelle: string;
    fichier: string;
    legende: string;
    prise_le: string | null;
    agent_nom: string;
    cree_le: string;
  }>(`/daily/photos?${parametres}`);

  const envoyer = async (evenement: React.FormEvent<HTMLFormElement>) => {
    evenement.preventDefault();
    const formulaire = new FormData(evenement.currentTarget);
    const succes = await action.executer(() =>
      requete("/daily/photos", { methode: "POST", corps: formulaire }),
    );
    if (succes) {
      setAjout(false);
      void photos.recharger();
    }
  };

  return (
    <div className="space-y-4">
      <Carte>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-45 flex-1">
            <Selection
              libelle="Chantier"
              value={projet}
              onChange={(evenement) => setProjet(evenement.target.value)}
              options={[
                { valeur: "", libelle: "Tous les chantiers" },
                ...(projets.donnees ?? []).map((element) => ({
                  valeur: element.id,
                  libelle: element.nom,
                })),
              ]}
            />
          </div>
          <div className="min-w-45 flex-1">
            <Selection
              libelle="Moment"
              value={categorie}
              onChange={(evenement) => setCategorie(evenement.target.value)}
              options={[{ valeur: "", libelle: "Tous les moments" }, ...CATEGORIES_PHOTO]}
            />
          </div>
          {peutEcrire ? (
            <Bouton onClick={() => setAjout(true)}>Ajouter une photo</Bouton>
          ) : null}
        </div>
      </Carte>

      {photos.chargement ? (
        <Chargement />
      ) : photos.erreur ? (
        <Alerte>{photos.erreur}</Alerte>
      ) : !photos.donnees?.length ? (
        <EtatVide
          titre="Aucune photo"
          description="Les prises de vue du chantier apparaitront ici."
        />
      ) : (
        <Grille colonnes={4}>
          {photos.donnees.map((photo) => (
            <Carte key={photo.id} sansPadding>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.fichier}
                alt={photo.legende || photo.categorie_libelle}
                className="h-40 w-full rounded-t-xl object-cover"
              />
              <div className="space-y-1 p-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge>{photo.categorie_libelle}</Badge>
                  <span className="text-xs text-ardoise-500">
                    {date(photo.prise_le ?? photo.cree_le)}
                  </span>
                </div>
                <p className="text-sm">{photo.legende || "Sans légende"}</p>
                <p className="text-xs text-ardoise-500">{photo.agent_nom}</p>
              </div>
            </Carte>
          ))}
        </Grille>
      )}

      <Modale
        ouverte={ajout}
        titre="Ajouter une photo"
        description="Le moment de la prise de vue est ce qui rend la photo utile."
        onFermer={() => setAjout(false)}
      >
        <form onSubmit={envoyer} className="space-y-4">
          {action.erreur ? <Alerte>{action.erreur}</Alerte> : null}

          <Selection
            libelle="Chantier"
            name="projet"
            required
            erreurs={action.champs.projet}
            options={[
              { valeur: "", libelle: "Choisir un chantier" },
              ...(projets.donnees ?? []).map((element) => ({
                valeur: element.id,
                libelle: element.nom,
              })),
            ]}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Selection
              libelle="Moment"
              name="categorie"
              required
              erreurs={action.champs.categorie}
              options={CATEGORIES_PHOTO}
            />
            <Champ
              libelle="Prise le"
              name="prise_le"
              type="date"
              defaultValue={aujourdhui()}
              erreurs={action.champs.prise_le}
            />
          </div>

          <Champ
            libelle="Fichier"
            name="fichier"
            type="file"
            accept="image/*"
            required
            erreurs={action.champs.fichier}
          />
          <Champ libelle="Légende" name="legende" erreurs={action.champs.legende} />

          <div className="flex justify-end gap-2 border-t border-ardoise-200 pt-4 dark:border-ardoise-700">
            <Bouton type="button" variante="secondaire" onClick={() => setAjout(false)}>
              Annuler
            </Bouton>
            <Bouton type="submit" chargement={action.enCours}>
              Enregistrer
            </Bouton>
          </div>
        </form>
      </Modale>
    </div>
  );
}

const CATEGORIES_PHOTO = [
  { valeur: "AVANT", libelle: "Avant" },
  { valeur: "PENDANT", libelle: "Pendant" },
  { valeur: "APRES", libelle: "Après" },
  { valeur: "SECURITE", libelle: "Sécurité" },
  { valeur: "QUALITE", libelle: "Qualité" },
];
