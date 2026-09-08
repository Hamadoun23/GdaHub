/**
 * Deux initiales lisibles a partir d'un nom, d'une adresse ou d'un compte de
 * role — decoupe sur espace, arobase, point ou tiret pour couvrir les trois
 * formes ("Hamadoun Cisse", "hcisse@gdamali.net", "resprod").
 */
export function initialesDepuis(nomAffiche: string): string {
  return nomAffiche
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot[0])
    .join("")
    .toUpperCase();
}
