"use client";

import { useEffect, useState } from "react";
import { fetchRapport, type ParamsRapport } from "@/jus/lib/api";

/**
 * Charge plusieurs rapports en parallèle pour alimenter un tableau de bord.
 *
 * Un rapport refusé (403 selon le rôle) est simplement absent du résultat :
 * un commercial n'a pas accès aux rapports de production, et son tableau de
 * bord doit malgré tout s'afficher.
 */
export function useRapports(modules: string[], params: ParamsRapport = {}) {
  const [data, setData] = useState<Record<string, Record<string, unknown>>>({});
  const [loading, setLoading] = useState(true);

  // Les dépendances sont sérialisées : un tableau littéral changerait de
  // référence à chaque rendu et relancerait la requête en boucle.
  const cle = JSON.stringify({ modules, params });

  useEffect(() => {
    let annule = false;
    const { modules: mods, params: p } = JSON.parse(cle) as {
      modules: string[];
      params: ParamsRapport;
    };

    Promise.all(
      mods.map((m) =>
        fetchRapport(m, p)
          .then((d) => [m, d] as const)
          .catch(() => null)
      )
    ).then((resultats) => {
      if (annule) return;
      const parModule: Record<string, Record<string, unknown>> = {};
      for (const r of resultats) {
        if (r) parModule[r[0]] = r[1];
      }
      setData(parModule);
      setLoading(false);
    });

    return () => {
      annule = true;
    };
  }, [cle]);

  return { data, loading };
}

/** Lit une valeur numérique dans un rapport éventuellement absent. */
export function valeur(
  data: Record<string, Record<string, unknown>>,
  module: string,
  cle: string
): number {
  return Number(data[module]?.[cle] ?? 0);
}

/** Lit une liste dans un rapport éventuellement absent. */
export function liste<T = Record<string, unknown>>(
  data: Record<string, Record<string, unknown>>,
  module: string,
  cle: string
): T[] {
  const v = data[module]?.[cle];
  return Array.isArray(v) ? (v as T[]) : [];
}
