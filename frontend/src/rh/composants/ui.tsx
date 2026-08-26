"use client";

import {
  useEffect,
  useId,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// --- Structure -------------------------------------------------------------

export function Carte({
  titre,
  sousTitre,
  actions,
  children,
  className,
  sansPadding,
}: {
  titre?: ReactNode;
  sousTitre?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  sansPadding?: boolean;
}) {
  return (
    <section className={cx("carte apparition", className)}>
      {(titre || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
          <div>
            {titre && (
              <h2 className="text-sm font-semibold text-slate-800">{titre}</h2>
            )}
            {sousTitre && (
              <p className="mt-0.5 text-xs text-slate-500">{sousTitre}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={sansPadding ? "" : "p-4 sm:p-5"}>{children}</div>
    </section>
  );
}

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
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
          {titre}
        </h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>
        )}
      </div>
      {/* Sur telephone, une action isolee occupe toute la largeur : elle se
          vise au pouce sans effort et ne flotte pas dans le vide. */}
      {actions && (
        <div className="flex flex-wrap gap-2 max-sm:w-full max-sm:*:flex-1">
          {actions}
        </div>
      )}
    </div>
  );
}

// --- Actions ---------------------------------------------------------------

type VarianteBouton = "principal" | "secondaire" | "discret" | "danger" | "succes";

/**
 * L'orange de marque (#FF6A3A) ne donne que 2,85:1 avec du blanc : superbe en
 * aplat, illisible en libelle de bouton. L'action principale prend donc le
 * niveau 700 de la meme famille — 4,80:1, conforme AA — et retrouve l'orange
 * vif au survol et sur l'anneau de focus.
 */
const STYLES_BOUTON: Record<VarianteBouton, string> = {
  principal:
    "bg-marque-700 text-white shadow-sm hover:bg-marque-800 active:bg-marque-900",
  secondaire:
    "bg-white text-slate-700 border border-slate-300 hover:border-slate-400 hover:bg-slate-50",
  discret: "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  danger: "bg-rose-600 text-white shadow-sm hover:bg-rose-700",
  succes: "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700",
};

export function Bouton({
  variante = "principal",
  taille = "normale",
  chargement,
  children,
  className,
  ...reste
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VarianteBouton;
  taille?: "normale" | "petite";
  chargement?: boolean;
}) {
  return (
    <button
      {...reste}
      disabled={reste.disabled || chargement}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition",
        "disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none",
        // Un doigt vise mal une cible de 28 px : les boutons gagnent en
        // hauteur sur telephone et retrouvent leur compacite au pointeur.
        taille === "petite"
          ? "px-3 py-2 text-xs sm:py-1.5"
          : "px-4 py-2.5 text-sm sm:py-2",
        STYLES_BOUTON[variante],
        className,
      )}
    >
      {chargement && (
        <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}

// --- Indicateurs -----------------------------------------------------------

export type TonBadge =
  | "neutre"
  | "info"
  | "succes"
  | "alerte"
  | "danger"
  | "marque";

const STYLES_BADGE: Record<TonBadge, string> = {
  neutre: "bg-slate-100 text-slate-700 ring-slate-200",
  info: "bg-sky-50 text-sky-700 ring-sky-200",
  succes: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  alerte: "bg-amber-50 text-amber-700 ring-amber-200",
  danger: "bg-rose-50 text-rose-700 ring-rose-200",
  marque: "bg-marque-50 text-marque-700 ring-marque-200",
};

export function Badge({
  ton = "neutre",
  children,
  className,
}: {
  ton?: TonBadge;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        STYLES_BADGE[ton],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function TuileStat({
  libelle,
  valeur,
  detail,
  ton = "neutre",
  icone,
}: {
  libelle: string;
  valeur: ReactNode;
  detail?: ReactNode;
  ton?: TonBadge;
  icone?: ReactNode;
}) {
  const accents: Record<TonBadge, string> = {
    neutre: "text-slate-900",
    info: "text-sky-700",
    succes: "text-emerald-700",
    alerte: "text-amber-700",
    danger: "text-rose-700",
    marque: "text-marque-700",
  };
  return (
    <div className="carte apparition p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {libelle}
        </p>
        {icone && <span className="text-slate-300">{icone}</span>}
      </div>
      <p className={cx("mt-2 text-2xl font-semibold tabular-nums", accents[ton])}>
        {valeur}
      </p>
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
    </div>
  );
}

export function BarreProgression({
  valeur,
  max = 100,
  ton = "marque",
}: {
  valeur: number;
  max?: number;
  ton?: TonBadge;
}) {
  const couleurs: Record<TonBadge, string> = {
    neutre: "bg-slate-400",
    info: "bg-sky-500",
    succes: "bg-emerald-500",
    alerte: "bg-amber-500",
    danger: "bg-rose-500",
    marque: "bg-marque-500",
  };
  const ratio = max > 0 ? Math.min(Math.max((valeur / max) * 100, 0), 100) : 0;
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
      role="progressbar"
      aria-valuenow={Math.round(ratio)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cx("h-full rounded-full transition-all", couleurs[ton])}
        style={{ width: `${ratio}%` }}
      />
    </div>
  );
}

// --- Etats -----------------------------------------------------------------

export function Chargement({ libelle = "Chargement..." }: { libelle?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
      <span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-marque-600" />
      {libelle}
    </div>
  );
}

export function Alerte({
  ton = "danger",
  titre,
  children,
}: {
  ton?: TonBadge;
  titre?: string;
  children: ReactNode;
}) {
  const styles: Record<TonBadge, string> = {
    neutre: "bg-slate-50 text-slate-700 border-slate-200",
    info: "bg-sky-50 text-sky-800 border-sky-200",
    succes: "bg-emerald-50 text-emerald-800 border-emerald-200",
    alerte: "bg-amber-50 text-amber-800 border-amber-200",
    danger: "bg-rose-50 text-rose-800 border-rose-200",
    marque: "bg-marque-50 text-marque-800 border-marque-200",
  };
  return (
    <div className={cx("rounded-lg border px-4 py-3 text-sm", styles[ton])}>
      {titre && <p className="font-semibold">{titre}</p>}
      <div className={titre ? "mt-0.5" : undefined}>{children}</div>
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
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <svg viewBox="0 0 24 24" fill="none" className="size-5" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-sm font-medium text-slate-700">{titre}</p>
      {description && (
        <p className="max-w-sm text-xs text-slate-500">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// --- Formulaires -----------------------------------------------------------

function MessagesErreur({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-xs text-rose-600">{messages.join(" ")}</p>;
}

export function Champ({
  libelle,
  erreurs,
  aide,
  className,
  liste,
  ...reste
}: InputHTMLAttributes<HTMLInputElement> & {
  libelle: string;
  erreurs?: string[];
  aide?: string;
  /** Suggestions proposees sans restreindre la saisie (datalist HTML). */
  liste?: string[];
}) {
  const idListe = useId();
  const suggestions = liste?.length ? liste : null;
  return (
    <label className={cx("block", className)}>
      <span className="etiquette">{libelle}</span>
      <input {...reste} list={suggestions ? idListe : undefined} className="champ" />
      {suggestions && (
        <datalist id={idListe}>
          {suggestions.map((valeur) => (
            <option key={valeur} value={valeur} />
          ))}
        </datalist>
      )}
      {aide && <p className="mt-1 text-xs text-slate-400">{aide}</p>}
      <MessagesErreur messages={erreurs} />
    </label>
  );
}

export function ZoneTexte({
  libelle,
  erreurs,
  className,
  ...reste
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  libelle: string;
  erreurs?: string[];
}) {
  return (
    <label className={cx("block", className)}>
      <span className="etiquette">{libelle}</span>
      <textarea {...reste} rows={reste.rows ?? 3} className="champ resize-y" />
      <MessagesErreur messages={erreurs} />
    </label>
  );
}

export function Selection({
  libelle,
  erreurs,
  options,
  placeholder,
  className,
  ...reste
}: SelectHTMLAttributes<HTMLSelectElement> & {
  libelle: string;
  erreurs?: string[];
  placeholder?: string;
  options: { valeur: string | number; libelle: string }[];
}) {
  return (
    <label className={cx("block", className)}>
      <span className="etiquette">{libelle}</span>
      <select {...reste} className="champ">
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.valeur} value={option.valeur}>
            {option.libelle}
          </option>
        ))}
      </select>
      <MessagesErreur messages={erreurs} />
    </label>
  );
}

// --- Tableau ---------------------------------------------------------------

/**
 * Tableau qui se replie en cartes sous 768 px.
 *
 * Le repli est fait en CSS (voir `.tableau-reactif` dans `globals.css`) : les
 * intitules de colonnes descendent ici en variables, et la feuille de style
 * les ressort devant chaque valeur une fois la ligne empilee. Passer par des
 * variables plutot que par un attribut sur chaque cellule evite de toucher a
 * l'ecriture des pages — un tableau reste un tableau.
 */
export function Tableau({
  entetes,
  children,
  vide,
}: {
  entetes: string[];
  children: ReactNode;
  vide?: boolean;
}) {
  const intitules = Object.fromEntries(
    // `JSON.stringify` produit la chaine entre guillemets attendue par la
    // propriete `content` de CSS.
    entetes.map((entete, rang) => [`--entete-${rang + 1}`, JSON.stringify(entete)]),
  ) as CSSProperties;

  return (
    <div className="tableau-reactif overflow-x-auto" style={intitules}>
      <table className="w-full border-collapse text-sm md:min-w-160">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/70">
            {entetes.map((entete, rang) => (
              <th
                key={`${entete}-${rang}`}
                className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {entete}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {vide && (
        <EtatVide titre="Aucun element" description="Rien a afficher pour ces criteres." />
      )}
    </div>
  );
}

export function Cellule({
  children,
  className,
  colSpan,
}: {
  children: ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={cx("px-4 py-3 text-slate-700", className)}>
      {children}
    </td>
  );
}

// --- Modale ----------------------------------------------------------------

export function Modale({
  ouverte,
  titre,
  description,
  onFermer,
  children,
  large,
}: {
  ouverte: boolean;
  titre: string;
  description?: string;
  onFermer: () => void;
  children: ReactNode;
  large?: boolean;
}) {
  useEffect(() => {
    if (!ouverte) return;
    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key === "Escape") onFermer();
    };
    document.addEventListener("keydown", surTouche);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", surTouche);
      document.body.style.overflow = "";
    };
  }, [ouverte, onFermer]);

  if (!ouverte) return null;

  return (
    // Sur telephone, la modale monte du bas et colle au bord : le pouce
    // atteint ses boutons, et la fermeture reste a portee.
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-900/40 backdrop-blur-[1px] sm:items-start sm:p-8">
      <div
        className="absolute inset-0"
        onClick={onFermer}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        className={cx(
          "carte apparition relative z-10 w-full max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0",
          large ? "max-w-3xl" : "max-w-lg",
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{titre}</h2>
            {description && (
              <p className="mt-0.5 text-xs text-slate-500">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="max-h-[70dvh] overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:max-h-[75vh] sm:p-5 sm:pb-5">
          {children}
        </div>
      </div>
    </div>
  );
}

// --- Blocs de lecture simple ----------------------------------------------

/**
 * Grande valeur mise en avant. Un ecran ne devrait en porter qu'une : c'est
 * l'information que l'agent vient chercher.
 */
export function StatPrincipale({
  libelle,
  valeur,
  unite,
  detail,
  progression,
  ton = "marque",
}: {
  libelle: string;
  valeur: ReactNode;
  unite?: string;
  detail?: ReactNode;
  progression?: { valeur: number; max: number };
  ton?: TonBadge;
}) {
  const couleurs: Record<TonBadge, string> = {
    neutre: "text-slate-900",
    info: "text-sky-700",
    succes: "text-emerald-700",
    alerte: "text-amber-700",
    danger: "text-rose-700",
    marque: "text-marque-700",
  };
  return (
    <div className="carte apparition p-4 sm:p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {libelle}
      </p>
      <p className="mt-1.5 flex items-baseline gap-1.5">
        <span className={cx("text-4xl font-semibold tabular-nums", couleurs[ton])}>
          {valeur}
        </span>
        {unite && <span className="text-sm text-slate-500">{unite}</span>}
      </p>
      {progression && (
        <div className="mt-3">
          <BarreProgression
            valeur={progression.valeur}
            max={progression.max}
            ton={ton}
          />
        </div>
      )}
      {detail && <p className="mt-2 text-xs text-slate-500">{detail}</p>}
    </div>
  );
}

/** Bouton-carte : l'action principale d'un espace, visible sans chercher. */
export function ActionRapide({
  titre,
  description,
  icone,
  onClick,
  href,
}: {
  titre: string;
  description?: string;
  icone?: ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const contenu = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-marque-50 text-marque-600 transition group-hover:bg-marque-100">
        {icone}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-800">{titre}</span>
        {description && (
          <span className="block truncate text-xs text-slate-500">{description}</span>
        )}
      </span>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        className="size-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-marque-500"
        aria-hidden="true"
      >
        <path d="m9 6 6 6-6 6" />
      </svg>
    </>
  );
  const classes =
    "carte group flex w-full items-center gap-3 p-3.5 text-left transition hover:border-marque-200 hover:shadow-sm";

  return href ? (
    <a href={href} className={classes}>
      {contenu}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={classes}>
      {contenu}
    </button>
  );
}

/**
 * Liste en lignes lisibles, alternative aux tableaux denses pour les vues
 * personnelles : un titre, une precision, une valeur, un statut.
 */
export function ListeLignes({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-slate-100">{children}</ul>;
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
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{titre}</p>
        {detail && <p className="mt-0.5 truncate text-xs text-slate-500">{detail}</p>}
      </div>
      {valeur && (
        <span className="shrink-0 text-sm tabular-nums text-slate-700">{valeur}</span>
      )}
      {statut && <span className="shrink-0">{statut}</span>}
    </>
  );

  return (
    <li>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="flex w-full items-center gap-3 px-1 py-3 text-left transition hover:bg-slate-50/80"
        >
          {contenu}
        </button>
      ) : (
        <div className="flex items-center gap-3 px-1 py-3">{contenu}</div>
      )}
    </li>
  );
}

// --- Onglets ---------------------------------------------------------------

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
    // Replies sur deux ou trois lignes, les onglets mangent l'ecran ;
    // une bande qui defile horizontalement garde la page lisible.
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {onglets.map((onglet) => (
        <button
          key={onglet.cle}
          type="button"
          onClick={() => onChange(onglet.cle)}
          className={cx(
            "-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition sm:py-2",
            actif === onglet.cle
              ? "border-marque-600 text-marque-700"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700",
          )}
        >
          {onglet.libelle}
          {onglet.compteur !== undefined && (
            <span
              className={cx(
                "ml-1.5 rounded-full px-1.5 py-0.5 text-xs tabular-nums",
                actif === onglet.cle
                  ? "bg-marque-50 text-marque-700"
                  : "bg-slate-100 text-slate-500",
              )}
            >
              {onglet.compteur}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
