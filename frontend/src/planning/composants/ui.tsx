"use client";

/**
 * Les primitives visuelles de Planning.
 *
 * Alignees sur le systeme de conception partage du hub — Planning a
 * renonce a l'identite orange de Planning-main au profit d'un seul systeme,
 * commun a toutes les applications. Les signatures des composants restent
 * inchangees : chaque page continue de les appeler exactement comme avant,
 * seul l'habillage change.
 */

import { type ReactNode } from "react";
import type { StatutEvenement } from "../lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function EnTetePagePlanning({
  titre,
  sousTitre,
  actions,
}: {
  titre: string;
  sousTitre?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{titre}</h1>
        {sousTitre ? <p className="mt-1 text-sm text-muted-foreground">{sousTitre}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function Carte({
  titre,
  actions,
  sansPadding = false,
  children,
  className,
}: {
  titre?: string;
  actions?: ReactNode;
  sansPadding?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("mb-6 rounded-2xl bg-card text-card-foreground ring-1 ring-foreground/10", className)}>
      {titre ? (
        <header className="flex items-center justify-between gap-3 border-b px-6 py-4">
          <h2 className="text-sm font-semibold text-foreground">{titre}</h2>
          {actions}
        </header>
      ) : null}
      <div className={sansPadding ? "" : "p-6"}>{children}</div>
    </section>
  );
}

export function StatCard({ libelle, valeur }: { libelle: string; valeur: ReactNode }) {
  return (
    <div className="rounded-2xl bg-card p-6 text-card-foreground ring-1 ring-foreground/10">
      <h3 className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">{libelle}</h3>
      <div className="text-3xl font-semibold text-primary">{valeur}</div>
    </div>
  );
}

export function Bouton({
  variante = "primaire",
  children,
  className,
  ...reste
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "primaire" | "secondaire" | "danger" | "succes";
}) {
  const variantes = {
    primaire: "bg-primary text-primary-foreground hover:bg-primary/90",
    secondaire: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    danger: "bg-destructive text-white hover:bg-destructive/90",
    succes: "bg-emerald-600 text-white hover:bg-emerald-600/90",
  };
  return (
    <button
      {...reste}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
        variantes[variante],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function LienBouton({
  href,
  variante = "primaire",
  children,
  className,
}: {
  href: string;
  variante?: "primaire" | "secondaire" | "danger" | "succes";
  children: ReactNode;
  className?: string;
}) {
  const variantes = {
    primaire: "bg-primary text-primary-foreground hover:bg-primary/90",
    secondaire: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    danger: "bg-destructive text-white hover:bg-destructive/90",
    succes: "bg-emerald-600 text-white hover:bg-emerald-600/90",
  };
  return (
    <a
      href={href}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition",
        variantes[variante],
        className,
      )}
    >
      {children}
    </a>
  );
}

export function Chargement() {
  return <p className="py-10 text-center text-sm text-muted-foreground">Chargement...</p>;
}

export function Alerte({ variante = "danger", children }: { variante?: "danger" | "warning" | "success"; children: ReactNode }) {
  const styles = {
    danger: "border-destructive bg-destructive/10 text-destructive",
    warning: "border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
    success: "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  };
  return (
    <div className={cx("mb-4 rounded-lg border-l-4 px-4 py-3 text-sm", styles[variante])}>{children}</div>
  );
}

const LIBELLES_STATUT: Record<StatutEvenement, string> = {
  pending: "En attente",
  completed: "Complété",
  cancelled: "Annulé",
  not_realized: "Non réalisé",
  rescheduled: "Reprogrammé",
};

/** Meme logique de couleur que la legende du calendrier de production. */
export function Badge({
  status,
  isOverdue,
  isUpcoming,
}: {
  status: StatutEvenement;
  isOverdue?: boolean;
  isUpcoming?: boolean;
}) {
  let classes = "bg-muted text-muted-foreground";
  let libelle: string = LIBELLES_STATUT[status];

  if (status === "completed") classes = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";
  else if (status === "cancelled" || status === "not_realized") classes = "bg-muted text-muted-foreground";
  else if (status === "rescheduled") classes = "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200";
  else if (status === "pending" && isOverdue) {
    classes = "bg-destructive/15 text-destructive";
    libelle = "En retard";
  } else if (status === "pending" && isUpcoming) {
    classes = "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200";
    libelle = "À venir";
  }

  return <span className={cx("inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold", classes)}>{libelle}</span>;
}

export const STATUTS_EVENEMENT: { valeur: StatutEvenement; libelle: string }[] = [
  { valeur: "pending", libelle: "En attente" },
  { valeur: "completed", libelle: "Complété" },
  { valeur: "not_realized", libelle: "Non réalisé" },
  { valeur: "cancelled", libelle: "Annulé" },
  { valeur: "rescheduled", libelle: "Reprogrammé" },
];

export const STATUTS_NECESSITANT_RAISON = new Set(["not_realized", "cancelled", "rescheduled"]);

export const MOIS_FR = [
  "", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export function Champ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

export const CLASSE_ENTREE =
  "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30";

export function EtatVide({ children }: { children: ReactNode }) {
  return <div className="py-10 text-center text-muted-foreground">{children}</div>;
}

/** Tableau partage du domaine, sur les primitives shadcn (@/ui/table) — habille en carte arrondie. */
export function Tableau({
  entetes,
  children,
  sansCadre = false,
}: {
  entetes: string[];
  children: ReactNode;
  /** Omet la carte englobante (bordure/arrondi/fond) quand le tableau est deja dans une `Carte`. */
  sansCadre?: boolean;
}) {
  return (
    <div className={sansCadre ? "overflow-hidden" : "overflow-hidden rounded-2xl border border-border bg-card"}>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            {entetes.map((entete, rang) => (
              <TableHead
                key={`${entete}-${rang}`}
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {entete}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </div>
  );
}

export { TableRow as LigneTableau };

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
    <TableCell colSpan={colSpan} className={cx("text-foreground", className)}>
      {children}
    </TableCell>
  );
}
