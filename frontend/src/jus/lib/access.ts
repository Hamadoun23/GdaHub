// Matrice d'accès par rôle (reproduit le middleware Django).
// L'ordre compte : préfixes les plus spécifiques en premier.

import type { AuthUser } from "@/jus/lib/api";

type Rule = { prefix: string; roles: string[] };

const DIR = "Direction";
const RES = "ResProd";
const COM = "Commercial";
const FIN = "Finance";

export const routeAccess: Rule[] = [
  // Direction
  { prefix: "/jus/direction/utilisateurs", roles: [DIR] },
  { prefix: "/jus/direction", roles: [DIR] },
  // Production (ResProd)
  { prefix: "/jus/production", roles: [RES] },
  // Commercial
  { prefix: "/jus/commercial", roles: [COM] },
  // Finance : la Direction y accède en consultation. L'écriture reste
  // réservée au rôle Finance, contrôlée par l'API (CanFinance).
  { prefix: "/jus/finance", roles: [FIN, DIR] },
  // Reporting — accès différencié (spécifiques avant le générique)
  { prefix: "/jus/reporting/distribution", roles: [DIR, FIN, COM] },
  { prefix: "/jus/reporting/recolte", roles: [DIR, FIN, RES] },
  { prefix: "/jus/reporting/appro", roles: [DIR, FIN, RES] },
  { prefix: "/jus/reporting/fabrication", roles: [DIR, FIN, RES] },
  { prefix: "/jus/reporting/emballage", roles: [DIR, FIN, RES] },
  { prefix: "/jus/reporting/entrepot", roles: [DIR, FIN, RES] },
  { prefix: "/jus/reporting", roles: [DIR, FIN] }, // vue d'ensemble
];

function matchRule(pathname: string): Rule | undefined {
  return routeAccess.find(
    (r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/")
  );
}

export function canAccess(pathname: string, user: AuthUser | null): boolean {
  if (!user) return false;
  if (user.is_superuser) return true;
  const rule = matchRule(pathname);
  if (!rule) return true; // routes non protégées (ex: pages neutres)
  return rule.roles.some((r) => user.roles.includes(r));
}

// Page d'accueil selon le rôle (priorité Direction > ResProd > Commercial > Finance).
export function roleHome(user: AuthUser | null): string {
  if (!user) return "/connexion";
  if (user.is_superuser || user.roles.includes(DIR)) return "/jus/direction";
  if (user.roles.includes(RES)) return "/jus/production";
  if (user.roles.includes(COM)) return "/jus/commercial";
  if (user.roles.includes(FIN)) return "/jus/finance";
  return "/connexion";
}
