/**
 * Visite chaque route une fois, pour payer d'un coup le prix du mode
 * developpement.
 *
 * En developpement, Next.js ne compile une route qu'a sa premiere visite —
 * vingt a quarante secondes pour une page qui n'a jamais ete ouverte depuis le
 * dernier demarrage. Sans ce script, c'est la premiere personne qui clique qui
 * paie ce prix, et ca ressemble a une application cassee : un ecran de
 * chargement qui ne bouge plus.
 *
 * Ce n'est pas un correctif — le mode developpement fonctionne ainsi, et
 * `next build` (mode production) n'a pas cette contrainte. C'est un geste
 * d'attente : lance ce script juste apres `docker compose up`, avant d'ouvrir
 * l'application, et le premier clic sur chaque ecran ne recompile plus rien.
 *
 * Une route qui change de fichier redevient froide : ce script se relance
 * alors autant de fois que necessaire, sans effet de bord — il ne fait que
 * des GET.
 *
 * Usage : node scripts/prechauffer.mjs [adresse-de-base]
 *   node scripts/prechauffer.mjs                       # http://localhost:8080
 *   node scripts/prechauffer.mjs http://localhost:8080
 */

const BASE = process.argv[2] || "http://localhost:8080";

// Les routes dynamiques ([id], [chemin]) n'ont pas d'adresse fixe a visiter :
// elles se rechauffent avec le groupe de routes dont elles partagent le code
// (compile par segment, pas par page individuelle).
const ROUTES = [
  "/",
  "/connexion",
  "/tableau-de-bord",
  "/mon-compte",
  "/administration",
  "/rh/tableau-de-bord",
  "/rh/annuaire",
  "/rh/organisation",
  "/rh/absences",
  "/rh/retards",
  "/rh/mes-demandes",
  "/rh/validations",
  "/rh/permissions",
  "/rh/historique",
  "/rh/mon-espace",
  "/jus/production",
  "/jus/production/producteurs",
  "/jus/production/cueillettes",
  "/jus/production/receptions",
  "/jus/production/productions",
  "/jus/production/conditionnements",
  "/jus/production/bouteilles",
  "/jus/production/inventaires",
  "/jus/production/articles",
  "/jus/commercial",
  "/jus/commercial/clients",
  "/jus/commercial/commandes",
  "/jus/commercial/ventes",
  "/jus/commercial/paiements",
  "/jus/commercial/prospection",
  "/jus/finance",
  "/jus/finance/tresorerie",
  "/jus/direction",
  "/jus/direction/utilisateurs",
  "/jus/reporting",
  "/jus/reporting/recolte",
  "/jus/reporting/fabrication",
  "/jus/reporting/emballage",
  "/jus/reporting/entrepot",
  "/jus/reporting/appro",
  "/jus/reporting/distribution",
];

async function visiter(chemin) {
  const debut = Date.now();
  try {
    const reponse = await fetch(`${BASE}${chemin}`, { redirect: "manual" });
    return { chemin, statut: reponse.status, duree: Date.now() - debut };
  } catch (erreur) {
    return { chemin, statut: "?", duree: Date.now() - debut, erreur: String(erreur) };
  }
}

console.log(`Prechauffage de ${ROUTES.length} routes sur ${BASE}...\n`);

for (const chemin of ROUTES) {
  const { statut, duree, erreur } = await visiter(chemin);
  const lent = duree > 3000 ? "  <- compilation" : "";
  console.log(`${String(duree).padStart(6)} ms  ${String(statut).padStart(3)}  ${chemin}${lent}`);
  if (erreur) console.log(`           ${erreur}`);
}

console.log("\nTermine. Le premier clic sur chaque ecran ne recompile plus rien.");
