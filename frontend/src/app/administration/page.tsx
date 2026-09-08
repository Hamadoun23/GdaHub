"use client";

/**
 * L'administration du hub : qui accede a quoi, et sous quel nom.
 *
 * L'ecran est bati autour du chainon qui manquait — `identifiant_local`. Une
 * habilitation accordee ne suffit pas a faire entrer quelqu'un : l'application
 * doit encore savoir de qui il s'agit. FinanceRH connait ses gens par leur
 * adresse professionnelle, Jus d'orange par des comptes de role, BDM par des
 * adresses fabriquees a la reprise depuis Laravel — quand elles existent.
 *
 * C'est du travail de donnees, pas de code : quelqu'un qui connait les gens
 * doit dire qui est qui. L'ecran ne fait donc qu'une chose, mais bien : rendre
 * ce travail faisable, et montrer ou il reste a faire.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { Alerte, Badge, Bouton, Carte, EnTetePage, EtatVide } from "@/composants/ui";
import { Coquille } from "@/composants/Coquille";
import { ErreurApi } from "@/lib/api";
import {
  rattachementIncertain,
  tirerListe,
  type ApplicationAdmin,
  type CompteAdmin,
  type HabilitationAdmin,
  type Requete,
} from "@/lib/administration";
import { useSession } from "@/lib/session";

export default function PageAdministration() {
  return (
    <Coquille>
      <Contenu />
    </Coquille>
  );
}

function Contenu() {
  const { profil, requete } = useSession();
  const [comptes, setComptes] = useState<CompteAdmin[] | null>(null);
  const [applications, setApplications] = useState<ApplicationAdmin[]>([]);
  const [recherche, setRecherche] = useState("");
  const [choisi, setChoisi] = useState<number | null>(null);
  const [erreur, setErreur] = useState("");

  // `requete` porte le jeton et le renouvelle au besoin : on emprunte le meme
  // chemin que le reste du shell plutot que de gerer un jeton ici.
  const charger = useCallback(
    async (filtre: string) => {
      setErreur("");
      try {
        const [liste, apps] = await Promise.all([
          requete<unknown>(
            `/identity/utilisateurs${filtre ? `?search=${encodeURIComponent(filtre)}` : ""}`,
          ),
          requete<unknown>("/identity/applications"),
        ]);
        setComptes(tirerListe<CompteAdmin>(liste));
        setApplications(tirerListe<ApplicationAdmin>(apps).filter((a) => a.active));
      } catch (probleme) {
        setComptes([]);
        setErreur(
          probleme instanceof ErreurApi && probleme.statut === 403
            ? "Cet ecran est reserve aux administrateurs du hub."
            : probleme instanceof ErreurApi
              ? probleme.message
              : "L'annuaire ne repond pas.",
        );
      }
    },
    [requete],
  );

  // La frappe ne doit pas declencher une requete par lettre ; le premier
  // chargement, lui, n'a aucune raison d'attendre.
  useEffect(() => {
    const minuteur = window.setTimeout(() => charger(recherche), recherche ? 300 : 0);
    return () => window.clearTimeout(minuteur);
  }, [charger, recherche]);

  // Les comptes dont on sait qu'ils ne pourront pas entrer : ni identifiant
  // local, ni adresse. C'est le travail qui reste, et il doit se voir.
  const aCorriger = useMemo(
    () =>
      (comptes ?? []).filter((c) =>
        c.habilitations.some((h) => h.active && rattachementIncertain(c, h)),
      ),
    [comptes],
  );

  if (!profil) return null;

  const compte = (comptes ?? []).find((c) => c.id === choisi) ?? null;

  return (
    <>
      <EnTetePage
        titre="Administration"
        description="Qui accede a quoi, et sous quel nom chaque application le connait."
        actions={
          aCorriger.length > 0 ? (
            <Badge ton="alerte">
              {aCorriger.length} compte{aCorriger.length > 1 ? "s" : ""} sans rattachement
            </Badge>
          ) : undefined
        }
      />

      {erreur ? (
        <div className="mb-6">
          <Alerte ton="danger">{erreur}</Alerte>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <Carte>
          <label htmlFor="recherche" className="sr-only">
            Rechercher un compte
          </label>
          <input
            id="recherche"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Nom, adresse, telephone..."
            className="w-full rounded-xl border border-ardoise-200 bg-transparent px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-ardoise-500 focus:border-marque focus:ring-2 focus:ring-marque/15 dark:border-ardoise-700"
          />

          <ul className="mt-3 max-h-[32rem] space-y-1 overflow-y-auto pr-1">
            {comptes === null ? (
              <li className="px-3 py-2 text-sm text-ardoise-500">Chargement...</li>
            ) : comptes.length === 0 ? (
              <li className="px-3 py-2 text-sm text-ardoise-500">Aucun compte.</li>
            ) : (
              comptes.map((c) => {
                const incomplet = c.habilitations.some(
                  (h) => h.active && rattachementIncertain(c, h),
                );
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setChoisi(c.id)}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${
                        c.id === choisi
                          ? "bg-ardoise-100 font-medium dark:bg-ardoise-700"
                          : "hover:bg-ardoise-100 dark:hover:bg-ardoise-700"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate">
                          {c.nom_complet || c.identifiant}
                        </span>
                        <span className="block truncate text-xs text-ardoise-500">
                          {c.identifiant}
                        </span>
                      </span>
                      {!c.est_actif ? (
                        <span className="shrink-0 text-xs text-ardoise-500">inactif</span>
                      ) : incomplet ? (
                        <span
                          title="Habilitation accordee, mais l'application ne sait pas de qui il s'agit"
                          className="h-2 w-2 shrink-0 rounded-full bg-amber-500"
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </Carte>

        <section>
          {compte === null ? (
            <div className="rounded-2xl border border-dashed border-ardoise-200 bg-white p-8 dark:border-ardoise-700 dark:bg-ardoise-900">
              <EtatVide titre="Aucun compte selectionne" description="Choisissez un compte pour voir ses habilitations." />
            </div>
          ) : (
            <FicheCompte
              key={compte.id}
              compte={compte}
              applications={applications}
              requete={requete}
              surChangement={() => charger(recherche)}
            />
          )}
        </section>
      </div>
    </>
  );
}

function FicheCompte({
  compte,
  applications,
  requete,
  surChangement,
}: {
  compte: CompteAdmin;
  applications: ApplicationAdmin[];
  requete: Requete;
  surChangement: () => void;
}) {
  return (
    <Carte>
      <h2 className="font-medium">{compte.nom_complet || compte.identifiant}</h2>
      <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ardoise-500">
        <div>
          <dt className="sr-only">Identifiant de connexion</dt>
          <dd>{compte.identifiant}</dd>
        </div>
        {compte.fonction ? (
          <div>
            <dt className="sr-only">Fonction</dt>
            <dd>{compte.fonction}</dd>
          </div>
        ) : null}
        {compte.telephone ? (
          <div>
            <dt className="sr-only">Telephone</dt>
            <dd>{compte.telephone}</dd>
          </div>
        ) : null}
        <div>
          <dt className="sr-only">Etat</dt>
          <dd>{compte.est_actif ? "actif" : "inactif"}</dd>
        </div>
      </dl>

      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-ardoise-500">
        Applications
      </h3>

      <div className="mt-3 space-y-3">
        {applications.map((application) => (
          <LigneHabilitation
            key={application.id}
            compte={compte}
            application={application}
            habilitation={compte.habilitations.find(
              (h) => h.application === application.id,
            )}
            requete={requete}
            surChangement={surChangement}
          />
        ))}
      </div>
    </Carte>
  );
}

function LigneHabilitation({
  compte,
  application,
  habilitation,
  requete,
  surChangement,
}: {
  compte: CompteAdmin;
  application: ApplicationAdmin;
  habilitation?: HabilitationAdmin;
  requete: Requete;
  surChangement: () => void;
}) {
  const localEnregistre = habilitation?.identifiant_local ?? "";
  const rolesEnregistres = habilitation?.roles ?? [];

  const [local, setLocal] = useState(localEnregistre);
  const [roles, setRoles] = useState<string[]>(rolesEnregistres);
  const [etat, setEtat] = useState<"repos" | "envoi" | "enregistre">("repos");
  const [erreur, setErreur] = useState("");

  // Apres un enregistrement, la liste est rechargee : les champs doivent
  // repartir de ce que le serveur a reellement retenu, pas de la saisie.
  const signature = `${habilitation?.id ?? 0}|${localEnregistre}|${rolesEnregistres.join()}`;
  useEffect(() => {
    setLocal(localEnregistre);
    setRoles(rolesEnregistres);
    setErreur("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const accorde = habilitation !== undefined && habilitation.active;
  const incertain = habilitation ? rattachementIncertain(compte, habilitation) : false;
  const modifie =
    local.trim() !== localEnregistre || roles.join() !== rolesEnregistres.join();

  async function enregistrer() {
    setEtat("envoi");
    setErreur("");
    try {
      if (habilitation) {
        await requete(`/identity/habilitations/${habilitation.id}`, {
          methode: "PATCH",
          corps: { roles, identifiant_local: local.trim() },
        });
      } else {
        await requete("/identity/habilitations", {
          methode: "POST",
          corps: {
            utilisateur: compte.id,
            application: application.id,
            roles,
            identifiant_local: local.trim(),
          },
        });
      }
      setEtat("enregistre");
      surChangement();
    } catch (probleme) {
      setEtat("repos");
      setErreur(
        probleme instanceof ErreurApi ? probleme.message : "Enregistrement impossible.",
      );
    }
  }

  async function basculer() {
    setEtat("envoi");
    setErreur("");
    try {
      if (habilitation) {
        await requete(`/identity/habilitations/${habilitation.id}`, {
          methode: "PATCH",
          corps: { active: !habilitation.active },
        });
      } else {
        await requete("/identity/habilitations", {
          methode: "POST",
          corps: { utilisateur: compte.id, application: application.id, roles: [] },
        });
      }
      setEtat("repos");
      surChangement();
    } catch (probleme) {
      setEtat("repos");
      setErreur(probleme instanceof ErreurApi ? probleme.message : "Modification impossible.");
    }
  }

  return (
    <div
      className={`rounded-2xl border p-4 transition ${
        accorde
          ? "border-ardoise-200 dark:border-ardoise-700"
          : "border-dashed border-ardoise-200 opacity-70 dark:border-ardoise-700"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-medium">
          <span
            aria-hidden
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: application.couleur || "var(--color-marque)" }}
          />
          {application.nom}
        </span>
        <Bouton
          type="button"
          variante="secondaire"
          taille="petite"
          onClick={basculer}
          disabled={etat === "envoi"}
        >
          {accorde ? "Retirer l'acces" : "Donner l'acces"}
        </Bouton>
      </div>

      {accorde ? (
        <>
          {application.roles_disponibles.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {application.roles_disponibles.map((role) => {
                const coche = roles.includes(role.code);
                return (
                  <label
                    key={role.code}
                    className={`cursor-pointer rounded-full border px-3 py-1 text-xs transition ${
                      coche
                        ? "border-marque bg-marque/10 font-medium text-marque"
                        : "border-ardoise-200 text-ardoise-500 hover:bg-ardoise-100 dark:border-ardoise-700 dark:hover:bg-ardoise-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={coche}
                      onChange={() =>
                        setRoles((actuels) =>
                          coche
                            ? actuels.filter((r) => r !== role.code)
                            : [...actuels, role.code],
                        )
                      }
                    />
                    {role.libelle}
                  </label>
                );
              })}
            </div>
          ) : null}

          <div className="mt-4">
            <label
              htmlFor={`local-${application.id}`}
              className="block text-xs font-medium text-ardoise-500"
            >
              Identifiant dans {application.nom}
            </label>
            <input
              id={`local-${application.id}`}
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder={`Vide si ${application.nom} le connait par son adresse`}
              className={`mt-1 w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none focus:border-marque focus:ring-2 focus:ring-marque/15 ${
                incertain
                  ? "border-amber-400 dark:border-amber-600"
                  : "border-ardoise-200 dark:border-ardoise-700"
              }`}
            />
            {incertain ? (
              <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
                Ce compte n&apos;a pas d&apos;adresse professionnelle : {application.nom}{" "}
                ne peut pas le reconnaitre tant que ce champ est vide, et la
                personne arrivera sur l&apos;ecran de connexion de
                l&apos;application.
              </p>
            ) : null}
          </div>

          {erreur ? (
            <p className="mt-2 text-xs text-red-700 dark:text-red-300">{erreur}</p>
          ) : null}

          <div className="mt-3 flex items-center gap-3">
            <Bouton
              type="button"
              taille="petite"
              onClick={enregistrer}
              disabled={!modifie || etat === "envoi"}
            >
              {etat === "envoi" ? "Enregistrement..." : "Enregistrer"}
            </Bouton>
            {etat === "enregistre" && !modifie ? (
              <span className="text-xs text-ardoise-500">Enregistre.</span>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
