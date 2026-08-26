// Transformations de données réelles vers le format attendu par les graphiques.

const COULEURS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const LIBELLE_MODE: Record<string, string> = {
  ESPECE: "Espèce",
  CHEQUE: "Chèque",
  VIREMENT: "Virement",
  MOBILE: "Mobile",
};

/**
 * Répartition des paiements par mode, pour un graphique en anneau.
 * Compte le nombre de paiements — comme le fait `paiements_mode` de l'API.
 */
export function modesEnDonut(paiements: Record<string, unknown>[]) {
  const parMode = new Map<string, number>();
  for (const p of paiements) {
    const mode = String(p.mode_paie ?? "AUTRE");
    parMode.set(mode, (parMode.get(mode) ?? 0) + 1);
  }
  return [...parMode.entries()].map(([mode, total], i) => ({
    name: LIBELLE_MODE[mode] ?? mode,
    value: total,
    fill: COULEURS[i % COULEURS.length],
  }));
}

/** Répartition générique { label, count } vers le format anneau. */
export function repartitionEnDonut(
  lignes: { label?: string; statut?: string; count?: number }[]
) {
  return lignes
    .filter((l) => (l.count ?? 0) > 0)
    .map((l, i) => ({
      name: l.label ?? l.statut ?? "—",
      value: Number(l.count ?? 0),
      fill: COULEURS[i % COULEURS.length],
    }));
}
