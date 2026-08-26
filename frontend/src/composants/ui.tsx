"use client";

/**
 * Les primitives d'interface de GDA Hub.
 *
 * Un seul jeu de composants pour les neuf modules : c'est ce qui fait qu'un
 * agent qui sait poser un conge sait deposer une depense sans rien
 * reapprendre. Chaque module compose ces briques, aucun ne redefinit les
 * siennes.
 */

import { type ReactNode } from "react";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// --- Structure ---------------------------------------------------------------

export function EnTetePage({
  titre,
  description,
  actions,
}: {
  titre: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{titre}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-ardoise-500">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  );
}

export function Carte({
  titre,
  sousTitre,
  actions,
  sansPadding = false,
  children,
}: {
  titre?: string;
  sousTitre?: string;
  actions?: ReactNode;
  sansPadding?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-ardoise-200 bg-white dark:border-ardoise-700 dark:bg-ardoise-900">
      {titre ? (
        <header className="flex items-center justify-between gap-3 border-b border-ardoise-200 px-5 py-3 dark:border-ardoise-700">
          <div>
            <h2 className="font-medium">{titre}</h2>
            {sousTitre ? (
              <p className="text-xs text-ardoise-500">{sousTitre}</p>
            ) : null}
          </div>
          {actions}
        </header>
      ) : null}
      <div className={sansPadding ? "" : "p-5"}>{children}</div>
    </section>
  );
}

export function Grille({
  colonnes = 3,
  children,
}: {
  colonnes?: 2 | 3 | 4;
  children: ReactNode;
}) {
  const classe = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
  }[colonnes];
  return <div className={cx("grid gap-4", classe)}>{children}</div>;
}

// --- Etats -------------------------------------------------------------------

export function Chargement({ libelle = "Chargement..." }: { libelle?: string }) {
  return (
    <p className="py-10 text-center text-sm text-ardoise-500" role="status">
      {libelle}
    </p>
  );
}

export function Alerte({
  titre,
  ton = "danger",
  children,
}: {
  titre?: string;
  ton?: "danger" | "avertissement" | "info";
  children: ReactNode;
}) {
  const tons = {
    danger:
      "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
    avertissement:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
    info:
      "border-ardoise-200 bg-ardoise-100 text-ardoise-700 dark:border-ardoise-700 dark:bg-ardoise-700/40 dark:text-ardoise-100",
  };
  return (
    <div role="alert" className={cx("rounded-lg border px-4 py-3 text-sm", tons[ton])}>
      {titre ? <p className="mb-1 font-medium">{titre}</p> : null}
      {children}
    </div>
  );
}

export function EtatVide({
  titre,
  description,
  action,
}: {
  titre: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="py-12 text-center">
      <p className="font-medium">{titre}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-sm text-sm text-ardoise-500">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

// --- Actions -----------------------------------------------------------------

export function Bouton({
  variante = "principal",
  taille = "normale",
  chargement = false,
  children,
  className,
  ...reste
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "principal" | "secondaire" | "danger" | "discret";
  taille?: "normale" | "petite";
  chargement?: boolean;
}) {
  const variantes = {
    principal: "bg-marque text-white hover:bg-marque-clair",
    secondaire:
      "border border-ardoise-200 hover:bg-ardoise-100 dark:border-ardoise-700 dark:hover:bg-ardoise-700",
    danger: "bg-red-600 text-white hover:bg-red-500",
    discret: "text-ardoise-500 hover:bg-ardoise-100 dark:hover:bg-ardoise-700",
  };
  const tailles = {
    normale: "px-4 py-2 text-sm",
    petite: "px-3 py-1.5 text-xs",
  };
  return (
    <button
      {...reste}
      disabled={reste.disabled || chargement}
      className={cx(
        "rounded-md font-medium transition disabled:opacity-60",
        variantes[variante],
        tailles[taille],
        className,
      )}
    >
      {chargement ? "..." : children}
    </button>
  );
}

export function Badge({
  ton = "neutre",
  children,
}: {
  ton?: "neutre" | "succes" | "alerte" | "danger" | "info";
  children: ReactNode;
}) {
  const tons = {
    neutre: "bg-ardoise-100 text-ardoise-700 dark:bg-ardoise-700 dark:text-ardoise-100",
    succes: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    alerte: "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-200",
    danger: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
    info: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  };
  return (
    <span
      className={cx(
        "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
        tons[ton],
      )}
    >
      {children}
    </span>
  );
}

// --- Saisie ------------------------------------------------------------------

export function Champ({
  libelle,
  erreurs,
  aide,
  liste,
  className,
  ...reste
}: React.InputHTMLAttributes<HTMLInputElement> & {
  libelle: string;
  erreurs?: string[];
  aide?: string;
  liste?: string[];
}) {
  const identifiantListe = liste ? `liste-${reste.name ?? libelle}` : undefined;
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{libelle}</span>
      <input
        {...reste}
        list={identifiantListe}
        className={cx(
          "w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-marque",
          erreurs?.length
            ? "border-red-400"
            : "border-ardoise-200 dark:border-ardoise-700",
          className,
        )}
      />
      {liste ? (
        <datalist id={identifiantListe}>
          {liste.map((valeur) => (
            <option key={valeur} value={valeur} />
          ))}
        </datalist>
      ) : null}
      {aide && !erreurs?.length ? (
        <span className="mt-1 block text-xs text-ardoise-500">{aide}</span>
      ) : null}
      {erreurs?.length ? (
        <span className="mt-1 block text-xs text-red-600">{erreurs.join(" ")}</span>
      ) : null}
    </label>
  );
}

export function ZoneTexte({
  libelle,
  erreurs,
  aide,
  className,
  ...reste
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  libelle: string;
  erreurs?: string[];
  aide?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{libelle}</span>
      <textarea
        {...reste}
        rows={reste.rows ?? 3}
        className={cx(
          "w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-marque",
          erreurs?.length
            ? "border-red-400"
            : "border-ardoise-200 dark:border-ardoise-700",
          className,
        )}
      />
      {aide && !erreurs?.length ? (
        <span className="mt-1 block text-xs text-ardoise-500">{aide}</span>
      ) : null}
      {erreurs?.length ? (
        <span className="mt-1 block text-xs text-red-600">{erreurs.join(" ")}</span>
      ) : null}
    </label>
  );
}

export function Selection({
  libelle,
  erreurs,
  options,
  className,
  ...reste
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  libelle: string;
  erreurs?: string[];
  options: { valeur: string | number; libelle: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{libelle}</span>
      <select
        {...reste}
        className={cx(
          "w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-marque",
          erreurs?.length
            ? "border-red-400"
            : "border-ardoise-200 dark:border-ardoise-700",
          className,
        )}
      >
        {options.map((option) => (
          <option key={option.valeur} value={option.valeur}>
            {option.libelle}
          </option>
        ))}
      </select>
      {erreurs?.length ? (
        <span className="mt-1 block text-xs text-red-600">{erreurs.join(" ")}</span>
      ) : null}
    </label>
  );
}

// --- Listes ------------------------------------------------------------------

export function ListeLignes({ children }: { children: ReactNode }) {
  return (
    <ul className="divide-y divide-ardoise-200 dark:divide-ardoise-700">{children}</ul>
  );
}

export function LigneListe({
  titre,
  detail,
  valeur,
  statut,
  onClick,
}: {
  titre: ReactNode;
  detail?: ReactNode;
  valeur?: ReactNode;
  statut?: ReactNode;
  onClick?: () => void;
}) {
  const contenu = (
    <div className="flex w-full items-center gap-4 py-3 text-left">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{titre}</p>
        {detail ? (
          <p className="truncate text-sm text-ardoise-500">{detail}</p>
        ) : null}
      </div>
      {valeur ? (
        <span className="shrink-0 text-sm tabular-nums text-ardoise-700 dark:text-ardoise-100">
          {valeur}
        </span>
      ) : null}
      {statut ? <span className="shrink-0">{statut}</span> : null}
    </div>
  );

  return (
    <li>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="w-full rounded-md px-1 transition hover:bg-ardoise-100 dark:hover:bg-ardoise-700"
        >
          {contenu}
        </button>
      ) : (
        <div className="px-1">{contenu}</div>
      )}
    </li>
  );
}

export function Onglets<T extends string>({
  onglets,
  actif,
  onChange,
}: {
  onglets: { cle: T; libelle: string; compteur?: number }[];
  actif: T;
  onChange: (cle: T) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-1 border-b border-ardoise-200 dark:border-ardoise-700">
      {onglets.map((onglet) => (
        <button
          key={onglet.cle}
          type="button"
          onClick={() => onChange(onglet.cle)}
          className={cx(
            "-mb-px border-b-2 px-4 py-2 text-sm transition",
            actif === onglet.cle
              ? "border-marque font-medium"
              : "border-transparent text-ardoise-500 hover:text-ardoise-700 dark:hover:text-ardoise-100",
          )}
        >
          {onglet.libelle}
          {onglet.compteur ? (
            <span className="ml-2 rounded-full bg-ardoise-100 px-1.5 py-0.5 text-xs dark:bg-ardoise-700">
              {onglet.compteur}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

// --- Indicateurs -------------------------------------------------------------

export function Statistique({
  libelle,
  valeur,
  unite,
  detail,
  ton = "neutre",
}: {
  libelle: string;
  valeur: ReactNode;
  unite?: string;
  detail?: string;
  ton?: "neutre" | "succes" | "alerte";
}) {
  const tons = {
    neutre: "text-ardoise-900 dark:text-ardoise-100",
    succes: "text-emerald-700 dark:text-emerald-300",
    alerte: "text-amber-700 dark:text-amber-300",
  };
  return (
    <div className="rounded-xl border border-ardoise-200 bg-white p-5 dark:border-ardoise-700 dark:bg-ardoise-900">
      <p className="text-xs uppercase tracking-wide text-ardoise-500">{libelle}</p>
      <p className={cx("mt-2 text-2xl font-semibold tabular-nums", tons[ton])}>
        {valeur}
        {unite ? (
          <span className="ml-1 text-sm font-normal text-ardoise-500">{unite}</span>
        ) : null}
      </p>
      {detail ? <p className="mt-1 text-xs text-ardoise-500">{detail}</p> : null}
    </div>
  );
}

// --- Modale ------------------------------------------------------------------

export function Modale({
  ouverte,
  titre,
  description,
  large = false,
  onFermer,
  children,
}: {
  ouverte: boolean;
  titre: string;
  description?: string;
  large?: boolean;
  onFermer: () => void;
  children: ReactNode;
}) {
  if (!ouverte) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ardoise-900/50 p-4 pt-16"
      role="dialog"
      aria-modal="true"
      onClick={onFermer}
    >
      <div
        onClick={(evenement) => evenement.stopPropagation()}
        className={cx(
          "w-full rounded-xl border border-ardoise-200 bg-white shadow-xl dark:border-ardoise-700 dark:bg-ardoise-900",
          large ? "max-w-3xl" : "max-w-lg",
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-ardoise-200 px-5 py-4 dark:border-ardoise-700">
          <div>
            <h2 className="font-medium">{titre}</h2>
            {description ? (
              <p className="mt-0.5 text-sm text-ardoise-500">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            className="rounded-md px-2 py-1 text-ardoise-500 transition hover:bg-ardoise-100 dark:hover:bg-ardoise-700"
          >
            ×
          </button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
