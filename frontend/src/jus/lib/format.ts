// Helpers de formatage (Franc CFA / XOF, dates, nombres).

export function xof(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(value) + " XOF";
}

export function num(value: number, unit = ""): string {
  const s = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(
    value
  );
  return unit ? `${s} ${unit}` : s;
}

export function frDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Heure au format 14:05, pour indiquer la dernière actualisation. */
export function heureCourte(d: Date): string {
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function pct(value: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(
    value
  )} %`;
}
