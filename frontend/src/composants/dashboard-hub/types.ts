/** Pagination d'identity : cles francaises, differentes du DRF par defaut. */
export type PageIdentity<T> = {
  total: number;
  page: number;
  pages: number;
  taille: number;
  suivant: string | null;
  precedent: string | null;
  resultats: T[];
};

export type ConnexionJournal = {
  id: number;
  identifiant_saisi: string;
  utilisateur: number | null;
  reussie: boolean;
  motif: string;
  adresse_ip: string | null;
  agent: string;
  date: string;
};
