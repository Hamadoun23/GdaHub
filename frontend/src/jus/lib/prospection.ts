// Correspondances statut → couleur/libellé, partagées par la carte, la liste
// et la fiche. Le serveur décide de la couleur (champ `couleur` du point) ;
// ici on ne fait que traduire ce nom en valeurs d'affichage.

import type { Tone } from "@/jus/composants/app/status-badge";
import type { StatutProspection } from "@/jus/lib/api";

export type MetaStatut = {
  valeur: StatutProspection;
  label: string;
  /** Couleur du marqueur sur la carte. Doit rester lisible sur fond de carte. */
  hex: string;
  tone: Tone;
};

export const STATUTS: MetaStatut[] = [
  { valeur: "PROSPECTE", label: "Prospecté", hex: "#3b82f6", tone: "blue" },
  { valeur: "INTERESSE", label: "Intéressé", hex: "#06b6d4", tone: "blue" },
  { valeur: "CLIENT", label: "Client", hex: "#10b981", tone: "green" },
  { valeur: "PARTENAIRE", label: "Partenaire", hex: "#8b5cf6", tone: "violet" },
  { valeur: "A_RELANCER", label: "À relancer", hex: "#f97316", tone: "orange" },
  { valeur: "REFUS", label: "Non intéressé", hex: "#ef4444", tone: "red" },
];

const PAR_VALEUR = new Map(STATUTS.map((s) => [s.valeur, s]));

const INCONNU: MetaStatut = {
  valeur: "PROSPECTE",
  label: "—",
  hex: "#94a3b8",
  tone: "gray",
};

export function metaStatut(statut: string): MetaStatut {
  return PAR_VALEUR.get(statut as StatutProspection) ?? INCONNU;
}

/** Centre par défaut de la carte : Bamako, siège de l'exploitation. */
export const CENTRE_DEFAUT: [number, number] = [12.6392, -8.0029];
export const ZOOM_DEFAUT = 12;

/** Coordonnées formatées pour l'affichage (6 décimales ≈ 10 cm). */
export function coords(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

/** Date + heure d'une visite, ex. « 07 août 2026 à 14:05 ». */
export function dateHeure(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Lien d'itinéraire vers le point de vente, ouvert dans l'application de
 * navigation du téléphone.
 *
 * Google Maps sert de choix universel : son URL fonctionne sur Android, sur
 * ordinateur et même sur iPhone. Apple Maps n'est proposé que sur les
 * appareils Apple, où c'est l'application installée par défaut — y envoyer un
 * utilisateur Android ouvrirait une page inutilisable.
 */
export function lienItineraire(
  latitude: number,
  longitude: number,
  { apple = false }: { apple?: boolean } = {}
): string {
  const destination = `${latitude},${longitude}`;
  return apple
    ? `https://maps.apple.com/?daddr=${destination}&dirflg=d`
    : `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
}

/** Vrai sur iPhone, iPad et Mac, où Apple Plans est l'application native. */
export function estAppareilApple(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // Les iPad récents se présentent comme des Mac : le test tactile les
  // rattrape, sinon ils recevraient le lien de bureau.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints >= 0);
}

export type Position = { latitude: number; longitude: number; precision: number };

/**
 * Relève la position du commercial. Le navigateur n'expose la géolocalisation
 * qu'en HTTPS (ou sur localhost) : sur un accès en HTTP simple, l'appel échoue
 * silencieusement, d'où le message explicite plutôt qu'un bouton inerte.
 */
export function releverPosition(): Promise<Position> {
  return new Promise((resolve, rejeter) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      rejeter(new Error("Ce navigateur ne sait pas se géolocaliser."));
      return;
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      rejeter(
        new Error(
          "La géolocalisation exige une connexion sécurisée (https). Placez le point sur la carte."
        )
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          precision: p.coords.accuracy,
        }),
      (err) => {
        const messages: Record<number, string> = {
          1: "Géolocalisation refusée. Autorisez-la dans les réglages du navigateur.",
          2: "Position indisponible : aucun signal GPS capté.",
          3: "La localisation a pris trop de temps. Réessayez à ciel ouvert.",
        };
        rejeter(new Error(messages[err.code] ?? "Localisation impossible."));
      },
      // Le GPS du téléphone plutôt que la position réseau : sur le terrain,
      // une erreur de 2 km rendrait la carte inutilisable.
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}
