"use client";

/**
 * Module Campagnes.
 *
 * Deux publics sur le même écran. Le commercial y saisit ses ventes et suit
 * son classement ; l'administration y pilote les campagnes et déclenche les
 * primes. Ce que chacun voit dépend de son rôle, pas d'un onglet caché.
 */

import { useState } from "react";

import { Coquille } from "@/composants/Coquille";
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
} from "@/composants/ui";
import { date, dateHeure, montant } from "@/lib/format";
import { useAction, useListe, useRessource } from "@/lib/ressources";
import { useSession } from "@/lib/session";

type Campagne = {
  id: number;
  nom: string;
  partenaire: number | null;
  partenaire_nom: string;
  date_debut: string;
  date_fin: string;
  statut_effectif: string;
  ouverte: boolean;
  sans_agences: boolean;
  prime_meilleur_vendeur: string;
  type_campagne_libelle: string;
};

type Vente = {
  id: number;
  client_nom: string;
  type_carte_libelle: string;
  commercial_nom: string;
  agence_nom: string;
  statut_activation: string;
  corrigible: boolean;
  adhesion_requise: boolean;
  cree_le: string;
};

type TypeCarte = { id: number; code: string; libelle: string; partenaire: number | null };

type LigneClassement = {
  rang: number;
  commercial_id: number;
  identifiant: string;
  nom_complet: string;
  agence: string;
  ventes: number;
};

type TableauCampagnes = {
  campagnes_ouvertes: number;
  mes_ventes: number;
  mes_ventes_du_jour: number;
  mes_enrolements: number;
  ventes_sans_adhesion: number;
  reclamations_ouvertes: number;
};

export default function PageCampagnes() {
  return (
    <Coquille>
      <Contenu />
    </Coquille>
  );
}

function Contenu() {
  const { profil } = useSession();
  const [onglet, setOnglet] = useState<"ventes" | "campagnes" | "classement">(
    "ventes",
  );
  const [campagneChoisie, setCampagneChoisie] = useState<number | null>(null);
  const [saisie, setSaisie] = useState(false);

  const roles = profil?.habilitations.bdm ?? [];
  const pilote = roles.includes("admin") || roles.includes("direction");

  const tableau = useRessource<TableauCampagnes>("/bdm/tableau-de-bord");
  const ouvertes = useListe<Campagne>("/bdm/campagnes/ouvertes");
  const toutes = useListe<Campagne>(
    onglet === "campagnes" ? "/bdm/campagnes?taille=100" : null,
  );
  const ventes = useListe<Vente>(
    onglet === "ventes" ? "/bdm/ventes?taille=100" : null,
  );
  const types = useListe<TypeCarte>("/bdm/types-cartes?actif=true&taille=100");
  const classement = useListe<LigneClassement>(
    onglet === "classement" && campagneChoisie
      ? `/bdm/campagnes/${campagneChoisie}/classement`
      : null,
  );

  const chiffres = tableau.donnees;

  return (
    <>
      <EnTetePage
        titre="Campagnes"
        description="Ventes de cartes, enrôlements et primes."
        actions={
          ouvertes.donnees?.length ? (
            <Bouton onClick={() => setSaisie(true)}>Enregistrer une vente</Bouton>
          ) : null
        }
      />

      {chiffres?.ventes_sans_adhesion ? (
        <div className="mb-6">
          <Alerte ton="avertissement" titre="Fiches d'adhésion manquantes">
            {chiffres.ventes_sans_adhesion} vente(s) attendent leur demande
            d&apos;adhésion. Sans elle, la carte ne part pas en fabrication.
          </Alerte>
        </div>
      ) : null}

      <div className="mb-6">
        <Grille colonnes={4}>
          <Statistique
            libelle="Campagnes ouvertes"
            valeur={chiffres?.campagnes_ouvertes ?? 0}
          />
          <Statistique libelle="Mes ventes" valeur={chiffres?.mes_ventes ?? 0} />
          <Statistique
            libelle="Aujourd'hui"
            valeur={chiffres?.mes_ventes_du_jour ?? 0}
            ton={chiffres?.mes_ventes_du_jour ? "succes" : "neutre"}
          />
          <Statistique
            libelle="Réclamations ouvertes"
            valeur={chiffres?.reclamations_ouvertes ?? 0}
            ton={chiffres?.reclamations_ouvertes ? "alerte" : "succes"}
          />
        </Grille>
      </div>

      <Onglets
        onglets={[
          { cle: "ventes" as const, libelle: "Mes ventes" },
          { cle: "campagnes" as const, libelle: "Campagnes" },
          { cle: "classement" as const, libelle: "Classement" },
        ]}
        actif={onglet}
        onChange={setOnglet}
      />

      {onglet === "ventes" ? (
        <Carte sansPadding>
          <div className="px-4 sm:px-5">
            {ventes.chargement ? (
              <Chargement />
            ) : ventes.erreur ? (
              <div className="py-5">
                <Alerte>{ventes.erreur}</Alerte>
              </div>
            ) : !ventes.donnees?.length ? (
              <EtatVide
                titre="Aucune vente"
                description="Vos ventes apparaîtront ici."
                action={
                  ouvertes.donnees?.length ? (
                    <Bouton taille="petite" onClick={() => setSaisie(true)}>
                      Enregistrer une vente
                    </Bouton>
                  ) : null
                }
              />
            ) : (
              <ListeLignes>
                {ventes.donnees.map((vente) => (
                  <LigneListe
                    key={vente.id}
                    titre={`${vente.client_nom} — ${vente.type_carte_libelle}`}
                    detail={
                      <>
                        {dateHeure(vente.cree_le)}
                        {vente.agence_nom ? ` · ${vente.agence_nom}` : ""}
                        {vente.corrigible
                          ? " · corrigible"
                          : " · figée"}
                      </>
                    }
                    statut={
                      vente.adhesion_requise ? (
                        <Badge ton="alerte">Adhésion à saisir</Badge>
                      ) : (
                        <Badge ton="succes">{vente.statut_activation}</Badge>
                      )
                    }
                  />
                ))}
              </ListeLignes>
            )}
          </div>
        </Carte>
      ) : null}

      {onglet === "campagnes" ? (
        <Carte sansPadding>
          <div className="px-4 sm:px-5">
            {toutes.chargement ? (
              <Chargement />
            ) : !toutes.donnees?.length ? (
              <EtatVide titre="Aucune campagne" />
            ) : (
              <ListeLignes>
                {toutes.donnees.map((campagne) => (
                  <LigneListe
                    key={campagne.id}
                    titre={`${campagne.nom} — ${campagne.partenaire_nom || "sans partenaire"}`}
                    detail={
                      <>
                        {date(campagne.date_debut)} → {date(campagne.date_fin)} ·{" "}
                        {campagne.type_campagne_libelle}
                        {campagne.sans_agences ? " · sans réseau d'agences" : ""}
                      </>
                    }
                    valeur={montant(campagne.prime_meilleur_vendeur)}
                    statut={
                      <Badge ton={campagne.ouverte ? "succes" : "neutre"}>
                        {campagne.statut_effectif}
                      </Badge>
                    }
                    onClick={() => {
                      setCampagneChoisie(campagne.id);
                      setOnglet("classement");
                    }}
                  />
                ))}
              </ListeLignes>
            )}
          </div>
        </Carte>
      ) : null}

      {onglet === "classement" ? (
        <div className="space-y-4">
          <div className="max-w-sm">
            <Selection
              libelle="Campagne"
              value={campagneChoisie ? String(campagneChoisie) : ""}
              onChange={(evenement) =>
                setCampagneChoisie(
                  evenement.target.value ? Number(evenement.target.value) : null,
                )
              }
              options={[
                { valeur: "", libelle: "Choisir une campagne" },
                ...(toutes.donnees ?? ouvertes.donnees ?? []).map((campagne) => ({
                  valeur: campagne.id,
                  libelle: campagne.nom,
                })),
              ]}
            />
          </div>

          <Carte
            titre="Classement des commerciaux"
            sousTitre="Ceux qui n'ont rien vendu y figurent aussi : les masquer ne dirait rien."
            actions={
              pilote && campagneChoisie ? (
                <BoutonPrimes
                  campagne={campagneChoisie}
                  onCalcule={() => void classement.recharger()}
                />
              ) : null
            }
            sansPadding
          >
            <div className="px-4 sm:px-5">
              {!campagneChoisie ? (
                <EtatVide
                  titre="Aucune campagne choisie"
                  description="Sélectionnez une campagne pour voir son classement."
                />
              ) : classement.chargement ? (
                <Chargement />
              ) : classement.erreur ? (
                <div className="py-5">
                  <Alerte>{classement.erreur}</Alerte>
                </div>
              ) : !classement.donnees?.length ? (
                <EtatVide
                  titre="Aucun commercial"
                  description="Cette campagne n'engage encore personne."
                />
              ) : (
                <ListeLignes>
                  {classement.donnees.map((ligne) => (
                    <LigneListe
                      key={ligne.commercial_id}
                      titre={`${ligne.rang}. ${ligne.nom_complet}`}
                      detail={ligne.agence || "Sans agence"}
                      valeur={`${ligne.ventes} vente(s)`}
                      statut={
                        ligne.rang === 1 && ligne.ventes > 0 ? (
                          <Badge ton="succes">Meilleur vendeur</Badge>
                        ) : null
                      }
                    />
                  ))}
                </ListeLignes>
              )}
            </div>
          </Carte>
        </div>
      ) : null}

      {saisie ? (
        <FormulaireVente
          campagnes={ouvertes.donnees ?? []}
          types={types.donnees ?? []}
          onFermer={() => setSaisie(false)}
          onEnregistre={() => {
            setSaisie(false);
            void ventes.recharger();
            void tableau.recharger();
          }}
        />
      ) : null}
    </>
  );
}

function BoutonPrimes({
  campagne,
  onCalcule,
}: {
  campagne: number;
  onCalcule: () => void;
}) {
  const { requete } = useSession();
  const action = useAction();
  const periode = new Date().toISOString().slice(0, 7);

  return (
    <Bouton
      taille="petite"
      variante="secondaire"
      chargement={action.enCours}
      onClick={async () => {
        const succes = await action.executer(() =>
          requete(`/bdm/campagnes/${campagne}/calculer-primes`, {
            methode: "POST",
            corps: { periode },
          }),
        );
        if (succes) onCalcule();
      }}
    >
      Calculer les primes ({periode})
    </Bouton>
  );
}

/**
 * La saisie d'une vente.
 *
 * Le commercial et l'agence ne sont pas demandés : ils viennent de la fiche
 * commerciale, côté serveur. Les laisser saisir permettrait d'attribuer une
 * vente à quelqu'un d'autre, et donc de déplacer une prime.
 */
function FormulaireVente({
  campagnes,
  types,
  onFermer,
  onEnregistre,
}: {
  campagnes: Campagne[];
  types: TypeCarte[];
  onFermer: () => void;
  onEnregistre: () => void;
}) {
  const { requete } = useSession();
  const action = useAction();
  const [campagne, setCampagne] = useState(campagnes[0] ? String(campagnes[0].id) : "");
  const [typeCarte, setTypeCarte] = useState(types[0] ? String(types[0].id) : "");
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [ville, setVille] = useState("");
  const [quartier, setQuartier] = useState("");

  const envoyer = async (evenement: React.FormEvent) => {
    evenement.preventDefault();
    const succes = await action.executer(async () => {
      // Le client d'abord : la vente s'y rattache. Deux appels plutôt qu'un,
      // parce qu'un même client peut acheter plusieurs cartes.
      const client = await requete<{ id: number }>("/bdm/clients", {
        methode: "POST",
        corps: {
          type_carte: Number(typeCarte),
          prenom,
          nom,
          telephone,
          ville,
          quartier,
        },
      });
      await requete("/bdm/ventes", {
        methode: "POST",
        corps: {
          campagne: Number(campagne),
          client: client.id,
          type_carte: Number(typeCarte),
        },
      });
    });
    if (succes) onEnregistre();
  };

  return (
    <Modale
      ouverte
      titre="Enregistrer une vente"
      description="Le client, puis la carte vendue."
      large
      onFermer={onFermer}
    >
      <form onSubmit={envoyer} className="space-y-4">
        {action.erreur ? <Alerte>{action.erreur}</Alerte> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Selection
            libelle="Campagne"
            value={campagne}
            onChange={(evenement) => setCampagne(evenement.target.value)}
            options={campagnes.map((candidate) => ({
              valeur: candidate.id,
              libelle: `${candidate.nom} (${candidate.partenaire_nom})`,
            }))}
            erreurs={action.champs.campagne}
          />
          <Selection
            libelle="Type de carte"
            value={typeCarte}
            onChange={(evenement) => setTypeCarte(evenement.target.value)}
            options={types.map((type) => ({
              valeur: type.id,
              libelle: type.libelle,
            }))}
            erreurs={action.champs.type_carte}
          />
          <Champ
            libelle="Prénom"
            value={prenom}
            onChange={(evenement) => setPrenom(evenement.target.value)}
            required
            erreurs={action.champs.prenom}
          />
          <Champ
            libelle="Nom"
            value={nom}
            onChange={(evenement) => setNom(evenement.target.value)}
            required
            erreurs={action.champs.nom}
          />
          <Champ
            libelle="Téléphone"
            value={telephone}
            onChange={(evenement) => setTelephone(evenement.target.value)}
            erreurs={action.champs.telephone}
          />
          <Champ
            libelle="Ville"
            value={ville}
            onChange={(evenement) => setVille(evenement.target.value)}
            erreurs={action.champs.ville}
          />
          <Champ
            libelle="Quartier"
            value={quartier}
            onChange={(evenement) => setQuartier(evenement.target.value)}
            erreurs={action.champs.quartier}
          />
        </div>

        <p className="text-xs text-ardoise-500">
          Vous pourrez corriger cette saisie pendant 48 heures. Passé ce délai,
          la correction se demande à l&apos;administration.
        </p>

        <div className="flex justify-end gap-2 border-t border-ardoise-200 pt-4 dark:border-ardoise-700">
          <Bouton type="button" variante="secondaire" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton
            type="submit"
            chargement={action.enCours}
            disabled={!campagne || !typeCarte || !nom.trim()}
          >
            Enregistrer
          </Bouton>
        </div>
      </form>
    </Modale>
  );
}
