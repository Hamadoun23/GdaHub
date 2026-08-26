"use client";

/**
 * Un écran de gestion, décrit plutôt qu'écrit.
 *
 * Les neuf services exposent une centaine de ressources — fournisseurs,
 * producteurs, agences, types de carte, formations… Les écrire une par une
 * donnerait quarante écrans presque identiques qui divergeraient au premier
 * correctif.
 *
 * Un module déclare donc ce qu'il expose : le chemin de l'API, les colonnes à
 * afficher, les champs à saisir. Le reste — liste, recherche, création,
 * correction, suppression, erreurs par champ — est écrit ici, une fois.
 *
 * Ce qui ne se déclare pas reste écrit à la main : le circuit de validation,
 * la saisie d'avancement d'un chantier, le calendrier éditorial. Ces
 * écrans-là portent un geste métier, pas un formulaire.
 */

import { useMemo, useState, type ReactNode } from "react";

import {
  Alerte,
  Badge,
  Bouton,
  Carte,
  Champ,
  Chargement,
  EtatVide,
  LigneListe,
  ListeLignes,
  Modale,
  Selection,
  ZoneTexte,
} from "@/composants/ui";
import { useAction, useListe } from "@/lib/ressources";
import { useSession } from "@/lib/session";

type Element = Record<string, unknown>;

export type Colonne = {
  /** Clé lue dans l'élément, ou fonction de rendu libre. */
  cle: string;
  libelle?: string;
  /** Le titre de la ligne. Une seule colonne devrait le porter. */
  principale?: boolean;
  /** La ligne de détail, sous le titre. Plusieurs colonnes s'y concatènent. */
  detail?: boolean;
  /** La valeur alignée à droite, généralement un montant ou un compte. */
  valeur?: boolean;
  /** Le badge de fin de ligne. */
  statut?: boolean;
  rendu?: (element: Element) => ReactNode;
};

export type Champ = {
  nom: string;
  libelle: string;
  type?: "texte" | "nombre" | "date" | "heure" | "courriel" | "booleen" | "zone" | "liste";
  /** Pour un type « liste » : les choix, fixes ou chargés d'une autre ressource. */
  options?: { valeur: string | number; libelle: string }[];
  source?: { chemin: string; libelle: string; vide?: string };
  requis?: boolean;
  aide?: string;
  defaut?: string;
  /** Largeur pleine dans la grille du formulaire. */
  large?: boolean;
};

export type SpecRessource = {
  titre: string;
  description?: string;
  /** Chemin de la collection, sans barre oblique finale : « /orange/producteurs ». */
  chemin: string;
  /** Paramètres ajoutés à la lecture : filtres, taille de page. */
  parametres?: string;
  colonnes: Colonne[];
  champs?: Champ[];
  /** Faux pour une ressource que ce profil ne peut que consulter. */
  ecriture?: boolean;
  /** Faux pour une ressource qui ne se supprime pas (une écriture comptable). */
  suppression?: boolean;
  recherche?: boolean;
  vide?: string;
  /** Rendu libre du détail d'un élément, dans la modale de consultation. */
  detail?: (element: Element) => ReactNode;
  actions?: { libelle: string; chemin: (element: Element) => string; corps?: Element }[];
};

function texte(valeur: unknown): string {
  if (valeur === null || valeur === undefined || valeur === "") return "";
  if (typeof valeur === "boolean") return valeur ? "oui" : "non";
  return String(valeur);
}

export function GestionRessource({ spec }: { spec: SpecRessource }) {
  const { requete } = useSession();
  const action = useAction();
  const [recherche, setRecherche] = useState("");
  const [edition, setEdition] = useState<Element | null>(null);
  const [consultation, setConsultation] = useState<Element | null>(null);

  const parametres = useMemo(() => {
    const p = new URLSearchParams(spec.parametres ?? "taille=100");
    if (spec.recherche && recherche.trim()) p.set("search", recherche.trim());
    return p.toString();
  }, [spec.parametres, spec.recherche, recherche]);

  const liste = useListe<Element>(`${spec.chemin}?${parametres}`);
  const ecriture = spec.ecriture !== false;

  const colonne = (role: keyof Colonne) =>
    spec.colonnes.filter((c) => c[role]);

  const rendre = (element: Element, c: Colonne): ReactNode =>
    c.rendu ? c.rendu(element) : texte(element[c.cle]);

  const supprimer = async (element: Element) => {
    const succes = await action.executer(() =>
      requete(`${spec.chemin}/${element.id}`, { methode: "DELETE" }),
    );
    if (succes) {
      setConsultation(null);
      void liste.recharger();
    }
  };

  const declencher = async (element: Element, chemin: string, corps?: Element) => {
    const succes = await action.executer(() =>
      requete(chemin, { methode: "POST", corps: corps ?? {} }),
    );
    if (succes) {
      setConsultation(null);
      void liste.recharger();
    }
  };

  return (
    <>
      <Carte
        titre={spec.titre}
        sousTitre={spec.description}
        actions={
          ecriture && spec.champs?.length ? (
            <Bouton taille="petite" onClick={() => setEdition({})}>
              Ajouter
            </Bouton>
          ) : null
        }
        sansPadding
      >
        {spec.recherche ? (
          <div className="border-b border-ardoise-200 p-4 dark:border-ardoise-700">
            <div className="max-w-sm">
              <Champ
                libelle="Rechercher"
                value={recherche}
                onChange={(evenement) => setRecherche(evenement.target.value)}
                placeholder="Nom, code, référence..."
              />
            </div>
          </div>
        ) : null}

        <div className="px-4 sm:px-5">
          {liste.chargement ? (
            <Chargement />
          ) : liste.erreur ? (
            <div className="py-5">
              <Alerte>{liste.erreur}</Alerte>
            </div>
          ) : !liste.donnees?.length ? (
            <EtatVide
              titre="Rien à afficher"
              description={spec.vide ?? "Aucun élément enregistré."}
              action={
                ecriture && spec.champs?.length ? (
                  <Bouton taille="petite" onClick={() => setEdition({})}>
                    Ajouter
                  </Bouton>
                ) : null
              }
            />
          ) : (
            <ListeLignes>
              {liste.donnees.map((element, rang) => (
                <LigneListe
                  key={texte(element.id) || rang}
                  titre={
                    colonne("principale")
                      .map((c) => rendre(element, c))
                      .filter(Boolean)
                      .map((v, i) => <span key={i}>{v}</span>)[0] ?? "—"
                  }
                  detail={colonne("detail")
                    .map((c) => texte(rendre(element, c) as string))
                    .filter(Boolean)
                    .join(" · ")}
                  valeur={colonne("valeur").map((c, i) => (
                    <span key={i}>{rendre(element, c)}</span>
                  ))}
                  statut={colonne("statut").map((c, i) => (
                    <span key={i}>{rendre(element, c)}</span>
                  ))}
                  onClick={() => setConsultation(element)}
                />
              ))}
            </ListeLignes>
          )}
        </div>
      </Carte>

      {/* Consultation : tout ce que l'API renvoie, plus les gestes possibles. */}
      <Modale
        ouverte={consultation !== null}
        titre={spec.titre}
        large
        onFermer={() => setConsultation(null)}
      >
        {consultation ? (
          <div className="space-y-5">
            {action.erreur ? <Alerte>{action.erreur}</Alerte> : null}

            {spec.detail ? (
              spec.detail(consultation)
            ) : (
              <dl className="grid gap-3 sm:grid-cols-2">
                {spec.colonnes.map((c) => (
                  <div key={c.cle}>
                    <dt className="text-xs uppercase tracking-wide text-ardoise-500">
                      {c.libelle ?? c.cle}
                    </dt>
                    <dd className="mt-0.5 text-sm">
                      {rendre(consultation, c) || "—"}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            <div className="flex flex-wrap gap-2 border-t border-ardoise-200 pt-4 dark:border-ardoise-700">
              {spec.actions?.map((a) => (
                <Bouton
                  key={a.libelle}
                  variante="secondaire"
                  chargement={action.enCours}
                  onClick={() => declencher(consultation, a.chemin(consultation), a.corps)}
                >
                  {a.libelle}
                </Bouton>
              ))}
              {ecriture && spec.champs?.length ? (
                <Bouton
                  variante="secondaire"
                  onClick={() => {
                    setEdition(consultation);
                    setConsultation(null);
                  }}
                >
                  Modifier
                </Bouton>
              ) : null}
              {ecriture && spec.suppression !== false ? (
                <Bouton
                  variante="danger"
                  chargement={action.enCours}
                  onClick={() => supprimer(consultation)}
                >
                  Supprimer
                </Bouton>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modale>

      {edition ? (
        <FormulaireRessource
          spec={spec}
          element={edition}
          onFermer={() => setEdition(null)}
          onEnregistre={() => {
            setEdition(null);
            void liste.recharger();
          }}
        />
      ) : null}
    </>
  );
}

function FormulaireRessource({
  spec,
  element,
  onFermer,
  onEnregistre,
}: {
  spec: SpecRessource;
  element: Element;
  onFermer: () => void;
  onEnregistre: () => void;
}) {
  const { requete } = useSession();
  const action = useAction();
  const champs = spec.champs ?? [];
  const correction = Boolean(element.id);

  const [valeurs, setValeurs] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      champs.map((c) => [
        c.nom,
        element[c.nom] === null || element[c.nom] === undefined
          ? (c.defaut ?? "")
          : String(element[c.nom]),
      ]),
    ),
  );

  const modifier = (nom: string, valeur: string) =>
    setValeurs((precedent) => ({ ...precedent, [nom]: valeur }));

  const envoyer = async (evenement: React.FormEvent) => {
    evenement.preventDefault();
    const corps: Record<string, unknown> = {};
    for (const champ of champs) {
      const brut = valeurs[champ.nom];
      if (champ.type === "booleen") {
        corps[champ.nom] = brut === "true";
      } else if (champ.type === "nombre") {
        corps[champ.nom] = brut === "" ? null : Number(brut);
      } else if (champ.type === "liste" && champ.source) {
        // Une référence vide vaut « aucun », pas la chaîne vide : le serveur
        // attend un identifiant ou null.
        corps[champ.nom] = brut === "" ? null : Number(brut);
      } else {
        corps[champ.nom] = brut === "" && !champ.requis ? null : brut;
      }
    }

    const succes = await action.executer(() =>
      correction
        ? requete(`${spec.chemin}/${element.id}`, { methode: "PATCH", corps })
        : requete(spec.chemin, { methode: "POST", corps }),
    );
    if (succes) onEnregistre();
  };

  return (
    <Modale
      ouverte
      titre={correction ? `Modifier — ${spec.titre}` : `Ajouter — ${spec.titre}`}
      large
      onFermer={onFermer}
    >
      <form onSubmit={envoyer} className="space-y-4">
        {action.erreur ? <Alerte>{action.erreur}</Alerte> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          {champs.map((champ) => (
            <div key={champ.nom} className={champ.large ? "sm:col-span-2" : ""}>
              <ChampDeclare
                champ={champ}
                valeur={valeurs[champ.nom] ?? ""}
                onChange={(valeur) => modifier(champ.nom, valeur)}
                erreurs={action.champs[champ.nom]}
              />
            </div>
          ))}
        </div>

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

function ChampDeclare({
  champ,
  valeur,
  onChange,
  erreurs,
}: {
  champ: Champ;
  valeur: string;
  onChange: (valeur: string) => void;
  erreurs?: string[];
}) {
  // Les choix d'une référence sont chargés depuis sa propre collection : un
  // formulaire ne devrait jamais demander de saisir un identifiant à la main.
  const source = useListe<Element>(
    champ.source ? `${champ.source.chemin}?taille=200` : null,
  );

  if (champ.type === "zone") {
    return (
      <ZoneTexte
        libelle={champ.libelle}
        value={valeur}
        onChange={(evenement) => onChange(evenement.target.value)}
        required={champ.requis}
        aide={champ.aide}
        erreurs={erreurs}
      />
    );
  }

  if (champ.type === "booleen") {
    return (
      <Selection
        libelle={champ.libelle}
        value={valeur || "false"}
        onChange={(evenement) => onChange(evenement.target.value)}
        options={[
          { valeur: "true", libelle: "Oui" },
          { valeur: "false", libelle: "Non" },
        ]}
        erreurs={erreurs}
      />
    );
  }

  if (champ.type === "liste") {
    const options = champ.source
      ? [
          { valeur: "", libelle: champ.source.vide ?? "Aucun" },
          ...(source.donnees ?? []).map((element) => ({
            valeur: texte(element.id),
            libelle: texte(element[champ.source!.libelle]),
          })),
        ]
      : (champ.options ?? []);
    return (
      <Selection
        libelle={champ.libelle}
        value={valeur}
        onChange={(evenement) => onChange(evenement.target.value)}
        options={options}
        erreurs={erreurs}
      />
    );
  }

  const types: Record<string, string> = {
    texte: "text",
    nombre: "number",
    date: "date",
    heure: "time",
    courriel: "email",
  };

  return (
    <Champ
      libelle={champ.libelle}
      type={types[champ.type ?? "texte"]}
      value={valeur}
      onChange={(evenement) => onChange(evenement.target.value)}
      required={champ.requis}
      aide={champ.aide}
      erreurs={erreurs}
    />
  );
}

/** Un badge coloré selon la valeur, pour les colonnes de statut. */
export function badgeStatut(
  valeur: unknown,
  tons: Record<string, "neutre" | "succes" | "alerte" | "danger" | "info"> = {},
  libelle?: string,
): ReactNode {
  const cle = texte(valeur);
  if (!cle) return null;
  return <Badge ton={tons[cle] ?? "neutre"}>{libelle ?? cle}</Badge>;
}
