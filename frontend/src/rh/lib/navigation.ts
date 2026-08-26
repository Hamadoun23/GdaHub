/**
 * Navigation de l'application.
 *
 * Un seul menu, le meme pour tout le monde : l'application se resume a trois gestes
 * — demander un conge, signaler un retard, soumettre une demande — plus le
 * suivi de ce qui a ete decide. Les deux entrees reservees aux valideurs
 * s'ajoutent a ce socle ; rien d'autre ne varie d'un profil a l'autre.
 *
 * Ce manifeste est la source unique de verite : il alimente le menu lateral
 * et la garde de routes du layout applicatif.
 */

import type { Utilisateur } from "./types";

export interface EntreeNav {
  libelle: string;
  href: string;
  /** Cle d'icone resolue par le composant de navigation. */
  icone: string;
  /** Description courte affichee sur l'accueil. */
  aide?: string;
}

export interface GroupeNav {
  titre: string;
  entrees: EntreeNav[];
}

/** Routes accessibles a tous, hors menu. */
const ROUTES_COMMUNES = ["/rh/tableau-de-bord", "/rh/mon-espace"];

const ACCUEIL: EntreeNav = {
  libelle: "Accueil",
  href: "/rh/tableau-de-bord",
  icone: "accueil",
};

const MES_CONGES: EntreeNav = {
  libelle: "Mes conges",
  href: "/rh/absences",
  icone: "conge",
  aide: "Poser des jours sur son solde annuel",
};

/**
 * La permission ne se demande pas dans l'ecran des conges.
 *
 * Les deux se ressemblent — une absence autorisee, le meme circuit de
 * validation — mais elles ne se decident pas sur les memes criteres : un
 * conge s'impute sur un solde annuel qui se planifie, une permission couvre
 * un imprevu de quelques heures et n'entame rien. Les melanger conduisait les
 * agents a poser des jours de conge pour un rendez-vous d'une matinee.
 */
const MES_PERMISSIONS: EntreeNav = {
  libelle: "Mes permissions",
  href: "/rh/permissions",
  icone: "permission",
  aide: "S'absenter sans entamer son solde",
};

const SIGNALER_RETARD: EntreeNav = {
  libelle: "Signaler un retard",
  href: "/rh/retards",
  icone: "presence",
  aide: "Prevenir d'une arrivee tardive",
};

const MES_DEMANDES: EntreeNav = {
  libelle: "Mes demandes",
  href: "/rh/mes-demandes",
  icone: "demande",
  aide: "Soumettre une demande a la Finance",
};

const HISTORIQUE: EntreeNav = {
  libelle: "Historique",
  href: "/rh/historique",
  icone: "requisition",
  aide: "Tout ce qui a ete demande et decide",
};

const A_VALIDER: EntreeNav = {
  libelle: "A valider",
  href: "/rh/validations",
  icone: "valider",
  aide: "Dossiers attendant votre decision",
};

const ORGANISATION: EntreeNav = {
  libelle: "Organisation",
  href: "/rh/organisation",
  icone: "annuaire",
  aide: "Repartir les agents par departement",
};

const ANNUAIRE: EntreeNav = {
  libelle: "Annuaire",
  href: "/rh/annuaire",
  icone: "annuaire",
  aide: "Coordonnees des collegues",
};

const MON_PROFIL: EntreeNav = {
  libelle: "Mon profil",
  href: "/rh/mon-espace",
  icone: "profil",
  aide: "Coordonnees et mot de passe",
};

/**
 * Se prononce sur les dossiers des autres : un encadrant, par le seul fait que
 * des agents lui sont rattaches, ou un profil de back-office, qui figure dans
 * le circuit au titre de son role.
 */
export function estValideur(utilisateur: Utilisateur): boolean {
  return (
    Boolean(utilisateur.est_encadrant) ||
    utilisateur.role === "RH" ||
    utilisateur.role === "FINANCE" ||
    utilisateur.role === "DIRECTION"
  );
}

/**
 * Classe les agents par departement.
 *
 * Reserve a la RH et a la Direction : ce rattachement designe le premier
 * valideur de chaque demande, ce n'est pas un simple libelle d'annuaire.
 */
export function gereLOrganigramme(utilisateur: Utilisateur): boolean {
  return utilisateur.role === "RH" || utilisateur.role === "DIRECTION";
}

export function menuPour(utilisateur: Utilisateur): GroupeNav[] {
  // Un valideur passe l'essentiel de son temps sur les dossiers des autres :
  // sa file et le registre viennent en tete, ses propres demarches ensuite.
  if (estValideur(utilisateur)) {
    return [
      { titre: "Decisions", entrees: [ACCUEIL, A_VALIDER, HISTORIQUE] },
      {
        titre: "Mes demarches",
        entrees: [MES_CONGES, MES_PERMISSIONS, SIGNALER_RETARD, MES_DEMANDES],
      },
      {
        titre: "Organisation",
        entrees: gereLOrganigramme(utilisateur)
          ? [ORGANISATION, ANNUAIRE, MON_PROFIL]
          : [ANNUAIRE, MON_PROFIL],
      },
    ];
  }

  return [
    {
      titre: "Mes demarches",
      entrees: [ACCUEIL, MES_CONGES, MES_PERMISSIONS, SIGNALER_RETARD, MES_DEMANDES],
    },
    { titre: "Suivi", entrees: [HISTORIQUE] },
    { titre: "Organisation", entrees: [MON_PROFIL] },
  ];
}

/**
 * Les quatre destinations de la barre basse, sur telephone.
 *
 * Une barre d'onglets ne supporte pas l'exhaustivite : au-dela de cinq
 * cibles, plus rien ne se vise au pouce. On garde donc le tout premier
 * geste de chaque groupe — ce qu'un agent ouvre plusieurs fois par jour —
 * et le cinquieme bouton, « Plus », donne acces au menu complet.
 */
export function barreBassePour(utilisateur: Utilisateur): EntreeNav[] {
  if (estValideur(utilisateur)) {
    return [ACCUEIL, A_VALIDER, MES_CONGES, HISTORIQUE];
  }
  return [ACCUEIL, MES_CONGES, MES_DEMANDES, HISTORIQUE];
}

/** Toutes les routes ouvertes au profil, menu et routes communes confondus. */
export function routesAutorisees(utilisateur: Utilisateur): string[] {
  const duMenu = menuPour(utilisateur).flatMap((groupe) =>
    groupe.entrees.map((entree) => entree.href),
  );
  return [...new Set([...duMenu, ...ROUTES_COMMUNES])];
}

/**
 * Un chemin est autorise s'il correspond a une entree du profil ou en decoule
 * (routes de detail). Sert de garde cote client ; l'API reste l'autorite.
 */
export function accesAutorise(utilisateur: Utilisateur, chemin: string): boolean {
  return routesAutorisees(utilisateur).some(
    (route) => chemin === route || chemin.startsWith(`${route}/`),
  );
}
