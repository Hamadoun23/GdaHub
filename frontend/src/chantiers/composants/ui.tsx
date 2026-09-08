"use client";

/**
 * Les primitives visuelles de Chantiers.
 *
 * Alignees sur le systeme de conception partage du hub (cartes, boutons,
 * couleurs) — Chantiers a renonce a sa propre identite visuelle (celle de
 * daily.gdamali.net) au profit d'un seul systeme, commun a toutes les
 * applications. Les signatures des composants restent inchangees : chaque
 * page continue de les appeler exactement comme avant, seul l'habillage
 * change.
 */

import { type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Button } from "@/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/** Conservee pour compatibilite : le hub impose desormais une seule police. */
export const POLICE = "";

export function EnTetePageChantier({
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
}: {
  titre?: string;
  actions?: ReactNode;
  sansPadding?: boolean;
  children: ReactNode;
}) {
  return (
    <Card className="mb-4">
      {titre ? (
        <CardHeader className="flex-row items-center justify-between border-b pb-4">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {titre}
          </CardTitle>
          {actions}
        </CardHeader>
      ) : null}
      <CardContent className={sansPadding ? "px-0" : undefined}>{children}</CardContent>
    </Card>
  );
}

const TONS_STAT = {
  bleu: "text-[color:var(--chart-2)]",
  vert: "text-[color:var(--chart-3)]",
  orange: "text-primary",
  rouge: "text-destructive",
} as const;

export function StatChantier({
  libelle,
  valeur,
  ton,
}: {
  libelle: string;
  valeur: ReactNode;
  ton: keyof typeof TONS_STAT;
}) {
  return (
    <Card>
      <CardContent>
        <p className={cx("text-3xl font-semibold tabular-nums", TONS_STAT[ton])}>{valeur}</p>
        <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{libelle}</p>
      </CardContent>
    </Card>
  );
}

/** La barre d'avancement d'une phase : neutre a 0%, orange en cours, verte a 100%. */
export function BarrePhase({ nom, pourcentage }: { nom: string; pourcentage: number }) {
  const couleurBarre =
    pourcentage === 100
      ? "bg-[color:var(--chart-3)]"
      : pourcentage > 0
        ? "bg-gradient-to-r from-primary to-[color-mix(in_oklch,var(--primary),black_15%)]"
        : "bg-muted";
  const couleurTexte = pourcentage === 100 ? "text-[color:var(--chart-3)]" : "text-primary";
  return (
    <div className="mb-2.5 grid grid-cols-[minmax(0,180px)_1fr_50px] items-center gap-3.5 last:mb-0">
      <span className="truncate text-sm font-medium text-foreground">{nom}</span>
      <span className="h-1.5 overflow-hidden rounded-full bg-muted">
        <span
          className={cx("block h-full rounded-full transition-[width] duration-500", couleurBarre)}
          style={{ width: `${pourcentage}%` }}
        />
      </span>
      <span className={cx("text-right text-sm font-semibold tabular-nums", couleurTexte)}>{pourcentage}%</span>
    </div>
  );
}

export function BoutonChantier({
  variante = "principal",
  children,
  className,
  ...reste
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: "principal" | "discret" }) {
  return (
    <Button variant={variante === "principal" ? "default" : "outline"} className={className} {...reste}>
      {children}
    </Button>
  );
}

export function Chargement() {
  return <p className="py-10 text-center text-sm text-muted-foreground">Chargement...</p>;
}

export function Alerte({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {children}
    </div>
  );
}

export function EtatVide({ children }: { children: ReactNode }) {
  return <div className="py-10 text-center text-sm text-muted-foreground">{children}</div>;
}

/** Tableau partage du domaine, sur les primitives shadcn (@/ui/table) — habille en carte arrondie. */
export function Tableau({
  entetes,
  children,
  vide,
  sansCadre = false,
}: {
  entetes: string[];
  children: ReactNode;
  vide?: boolean;
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
      {vide && <EtatVide>Aucun element a afficher pour ces criteres.</EtatVide>}
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
