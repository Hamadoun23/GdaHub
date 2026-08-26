/**
 * Sous quel chemin l'application est servie.
 *
 * A la racine — `rh.gdamali.net` — cette valeur est vide et rien ne change.
 * Servie par la passerelle de GDA Hub, elle vaut « /rh », et Next prefixe
 * alors ses propres routes tout seul (voir `basePath` dans next.config.ts).
 *
 * Restent les quelques adresses que Next ne prefixe pas parce qu'elles ne
 * passent pas par son routeur : le manifeste de l'application installable et
 * l'agent de service. C'est pour elles que cette constante existe.
 */
export const CHEMIN_BASE = process.env.NEXT_PUBLIC_CHEMIN_BASE ?? "";

/** Prefixe une adresse absolue du site par le chemin de base. */
export function chemin(adresse: string): string {
  return `${CHEMIN_BASE}${adresse}`;
}
