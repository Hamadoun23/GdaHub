// Construction de séries temporelles à partir des listes renvoyées par l'API.

const JOUR_COURT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
});

/**
 * Croise les cueillettes et les productions sur un même axe de dates.
 *
 * L'API ne fournit pas de série temporelle prête à l'emploi : on l'assemble
 * ici depuis les listes détaillées des rapports, ce qui garantit que la courbe
 * porte exactement les mêmes enregistrements que les tableaux.
 */
export function serieRecolteProduction(
  cueillettes: Record<string, unknown>[],
  productions: Record<string, unknown>[],
  maxPoints = 14
) {
  const parJour = new Map<string, { recolte: number; production: number }>();

  const ajouter = (
    date: unknown,
    champ: "recolte" | "production",
    valeur: unknown
  ) => {
    const jour = String(date ?? "").slice(0, 10);
    if (!jour) return;
    const courant = parJour.get(jour) ?? { recolte: 0, production: 0 };
    courant[champ] += Number(valeur ?? 0);
    parJour.set(jour, courant);
  };

  for (const c of cueillettes) ajouter(c.date_cueil, "recolte", c.qte_total);
  for (const p of productions) ajouter(p.date_of, "production", p.volume_final_l);

  return [...parJour.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-maxPoints)
    .map(([jour, v]) => ({
      jour: JOUR_COURT.format(new Date(jour)),
      recolte: Math.round(v.recolte),
      production: Math.round(v.production),
    }));
}
