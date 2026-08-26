/** Mise en forme des valeurs affichees, identique dans tous les modules. */

const LOCALE = "fr-FR";

export function montant(valeur: string | number | null | undefined, devise = "XOF") {
  const nombre = Number(valeur ?? 0);
  if (Number.isNaN(nombre)) return "—";
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: devise,
    maximumFractionDigits: 0,
  }).format(nombre);
}

export function nombre(
  valeur: string | number | null | undefined,
  decimales = 0,
) {
  const valeurNumerique = Number(valeur ?? 0);
  if (Number.isNaN(valeurNumerique)) return "—";
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valeurNumerique);
}

export function date(valeur: string | null | undefined) {
  if (!valeur) return "—";
  const jour = new Date(valeur);
  if (Number.isNaN(jour.getTime())) return "—";
  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(jour);
}

export function dateHeure(valeur: string | null | undefined) {
  if (!valeur) return "—";
  const instant = new Date(valeur);
  if (Number.isNaN(instant.getTime())) return "—";
  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(instant);
}

/** « 08:30 » a partir de « 08:30:00 ». */
export function heure(valeur: string | null | undefined) {
  if (!valeur) return "—";
  return valeur.slice(0, 5);
}

export function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

export function moisCourant(): string {
  return new Date().toISOString().slice(0, 7) + "-01";
}
