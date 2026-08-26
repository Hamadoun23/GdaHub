// Helpers pour transformer les valeurs de formulaire avant envoi à l'API.

type Values = Record<string, string | boolean>;

export function buildToApi(opts: {
  numbers?: string[];
  booleans?: string[];
  rename?: Record<string, string>;
  drop?: string[];
}) {
  return (values: Values): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(values)) {
      if (opts.drop?.includes(k)) continue;
      const key = opts.rename?.[k] ?? k;
      if (opts.numbers?.includes(k)) {
        out[key] = v === "" || v == null ? null : Number(v);
      } else if (opts.booleans?.includes(k)) {
        // Les listes Oui/Non renvoient la chaîne "true"/"false", pas un booléen.
        out[key] = v === true || v === "true";
      } else {
        out[key] = v;
      }
    }
    return out;
  };
}

// Récupère une valeur string sûre depuis un objet API.
export const str = (o: Record<string, unknown>, k: string): string =>
  (o[k] ?? "") as string;
export const nb = (o: Record<string, unknown>, k: string): number =>
  Number(o[k] ?? 0);
