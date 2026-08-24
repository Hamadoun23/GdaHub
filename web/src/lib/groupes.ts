/**
 * Regroupement des applications pour l'affichage.
 *
 * L'intitulé de la section vient d'identity, pas d'une liste écrite ici :
 * créer un nouveau bloc dans l'ERP ne doit pas demander de redéployer le
 * shell. L'ordre des sections se déduit de l'ordre des applications qu'elles
 * contiennent — Board porte les plus petits numéros, il sort donc en tête,
 * devant les quatre applications métier.
 */

import type { Application } from "./api";

export type Groupe = {
  titre: string;
  applications: Application[];
};

export function grouper(applications: Application[]): Groupe[] {
  const sections = new Map<string, Application[]>();

  for (const application of applications) {
    // Une application sans groupe n'est pas une erreur : elle forme sa propre
    // section, sans en-tête.
    const titre = application.groupe ?? "";
    const existantes = sections.get(titre);
    if (existantes) existantes.push(application);
    else sections.set(titre, [application]);
  }

  return [...sections.entries()]
    .map(([titre, liste]) => ({
      titre,
      applications: [...liste].sort((a, b) => a.ordre - b.ordre),
    }))
    .sort((a, b) => a.applications[0].ordre - b.applications[0].ordre);
}
