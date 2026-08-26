/** Formatage localise (fr-FR) des montants, dates et libelles metier. */

const formateurMontant = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
});

export function montant(valeur: string | number | null | undefined, devise = "XOF") {
  const nombre = Number(valeur ?? 0);
  if (Number.isNaN(nombre)) return "—";
  return `${formateurMontant.format(nombre)} ${devise}`;
}

export function nombre(valeur: string | number | null | undefined, decimales = 0) {
  const converti = Number(valeur ?? 0);
  if (Number.isNaN(converti)) return "—";
  return converti.toLocaleString("fr-FR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

export function pourcentage(valeur: number | string | null | undefined, decimales = 1) {
  const converti = Number(valeur ?? 0);
  if (Number.isNaN(converti)) return "—";
  return `${converti.toFixed(decimales).replace(".", ",")} %`;
}

export function date(valeur: string | null | undefined) {
  if (!valeur) return "—";
  const parsee = new Date(valeur);
  if (Number.isNaN(parsee.getTime())) return "—";
  return parsee.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function dateHeure(valeur: string | null | undefined) {
  if (!valeur) return "—";
  const parsee = new Date(valeur);
  if (Number.isNaN(parsee.getTime())) return "—";
  return parsee.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function heure(valeur: string | null | undefined) {
  if (!valeur) return "—";
  return valeur.slice(0, 5);
}

export function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

export function initiales(nomComplet: string) {
  return nomComplet
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot[0]?.toUpperCase() ?? "")
    .join("");
}

/** Duree lisible a partir d'un nombre de minutes de retard cumulees. */
export function duree(minutes: number) {
  if (!minutes) return "0 min";
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  if (!heures) return `${reste} min`;
  return reste ? `${heures} h ${reste} min` : `${heures} h`;
}
