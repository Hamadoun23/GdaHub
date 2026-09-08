"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import type { PointVente } from "@/jus/lib/api";
import {
  CENTRE_DEFAUT,
  ZOOM_DEFAUT,
  estAppareilApple,
  lienItineraire,
  metaStatut,
} from "@/jus/lib/prospection";
import { cn } from "@/lib/cn";

type Props = {
  points: PointVente[];
  /** Point mis en évidence (ouvert dans le panneau latéral). */
  selectionId?: number | null;
  onSelection?: (point: PointVente) => void;
  /**
   * Mode « placement » : le clic sur la carte renvoie des coordonnées au lieu
   * de désélectionner. Sert à poser un point sans être sur place.
   */
  onClicCarte?: (latitude: number, longitude: number) => void;
  /** Marqueur provisoire du point en cours de saisie. */
  provisoire?: { latitude: number; longitude: number } | null;
  className?: string;
};

/**
 * Carte OpenStreetMap des points prospectés.
 *
 * Leaflet touche `window` dès son chargement : il est donc importé
 * dynamiquement dans l'effet, jamais au niveau du module, sinon le rendu
 * serveur de Next planterait. Les marqueurs sont des `divIcon` (pastilles CSS)
 * plutôt que les icônes par défaut, dont les images se perdent au bundling et
 * qui ne savent pas porter une couleur par statut.
 */
export function CarteProspection({
  points,
  selectionId,
  onSelection,
  onClicCarte,
  provisoire,
  className,
}: Props) {
  const conteneur = useRef<HTMLDivElement>(null);
  const carte = useRef<Leaflet.Map | null>(null);
  const lib = useRef<typeof Leaflet | null>(null);
  const couche = useRef<Leaflet.LayerGroup | null>(null);
  const marqueurProvisoire = useRef<Leaflet.Marker | null>(null);
  /** Marqueurs déjà posés, par identifiant de point. */
  const marqueurs = useRef(new Map<number, Leaflet.Marker>());
  // Leaflet est chargé de façon asynchrone : sans cet état, les effets qui
  // dessinent les marqueurs s'exécuteraient une fois à vide (carte pas encore
  // créée) et ne seraient jamais rejoués si les points, eux, n'ont pas changé
  // depuis. Les points déjà enregistrés n'apparaissaient alors pas au premier
  // affichage de la page.
  const [pret, setPret] = useState(false);

  // Les callbacks changent à chaque rendu du parent ; les lire dans une ref
  // évite de détruire et recréer la carte (et de perdre le zoom) à chaque fois.
  // L'écriture se fait dans un effet : toucher une ref pendant le rendu casse
  // le rendu concurrent de React.
  const rappels = useRef({ onSelection, onClicCarte });
  useEffect(() => {
    rappels.current = { onSelection, onClicCarte };
  });

  // --- Création de la carte, une seule fois ---
  useEffect(() => {
    let annule = false;

    (async () => {
      const L = await import("leaflet");
      if (annule || !conteneur.current || carte.current) return;

      lib.current = L;
      const map = L.map(conteneur.current, {
        center: CENTRE_DEFAUT,
        zoom: ZOOM_DEFAUT,
      });

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      couche.current = L.layerGroup().addTo(map);
      map.on("click", (e: Leaflet.LeafletMouseEvent) => {
        rappels.current.onClicCarte?.(e.latlng.lat, e.latlng.lng);
      });

      carte.current = map;
      setPret(true);
      // La carte est créée avant que le conteneur ait sa taille définitive
      // (panneau latéral, polices) : sans ce recalcul, les tuiles s'affichent
      // en damier gris.
      setTimeout(() => map.invalidateSize(), 0);
    })();

    return () => {
      annule = true;
      carte.current?.remove();
      carte.current = null;
      couche.current = null;
      marqueurProvisoire.current = null;
      setPret(false);
    };
  }, []);

  /** Pastille d'un point, selon qu'il est sélectionné et que sa relance traîne. */
  function iconeDe(L: typeof Leaflet, point: PointVente, actif: boolean) {
    return L.divIcon({
      className: "",
      html: pastille(metaStatut(point.statut).hex, actif, point.relance_en_retard),
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
  }

  // --- Marqueurs des points ---
  // Ne dépend QUE de `points` : rebâtir la couche à chaque changement de
  // sélection détruisait le marqueur qu'on venait de cliquer, ce qui refermait
  // sa bulle d'itinéraire dans la foulée. La mise en évidence se fait plus bas,
  // en changeant l'icône des marqueurs déjà en place.
  useEffect(() => {
    const L = lib.current;
    const groupe = couche.current;
    if (!L || !groupe) return;

    groupe.clearLayers();
    marqueurs.current.clear();

    for (const point of points) {
      const meta = metaStatut(point.statut);
      const marqueur = L.marker([point.latitude, point.longitude], {
        title: point.nom,
        icon: iconeDe(L, point, false),
        // Les relances en retard passent au-dessus du reste.
        zIndexOffset: point.relance_en_retard ? 500 : 0,
      });

      marqueur.bindTooltip(
        `<strong>${echapper(point.nom)}</strong><br>${echapper(meta.label)}`,
        { direction: "top", offset: [0, -14] }
      );
      // Le lien d'itinéraire vit dans une bulle et non dans l'infobulle : une
      // infobulle Leaflet disparaît dès que le curseur la quitte, on ne
      // pourrait jamais cliquer dessus.
      marqueur.bindPopup(bulleItineraire(point, meta.label), {
        offset: [0, -12],
        closeButton: true,
      });
      marqueur.on("click", (e: Leaflet.LeafletMouseEvent) => {
        // Sans cela, le clic traverserait jusqu'à la carte et déclencherait
        // aussi le placement d'un nouveau point.
        L.DomEvent.stopPropagation(e);
        rappels.current.onSelection?.(point);
      });
      marqueur.addTo(groupe);
      marqueurs.current.set(point.id, marqueur);
    }
  }, [points, pret]);

  // --- Mise en évidence du point sélectionné ---
  useEffect(() => {
    const L = lib.current;
    if (!L) return;
    for (const point of points) {
      const marqueur = marqueurs.current.get(point.id);
      if (!marqueur) continue;
      const actif = point.id === selectionId;
      marqueur.setIcon(iconeDe(L, point, actif));
      marqueur.setZIndexOffset(actif ? 1000 : point.relance_en_retard ? 500 : 0);
    }
  }, [selectionId, points, pret]);

  // --- Marqueur du point en cours de saisie ---
  useEffect(() => {
    const L = lib.current;
    const map = carte.current;
    if (!L || !map) return;

    marqueurProvisoire.current?.remove();
    marqueurProvisoire.current = null;
    if (!provisoire) return;

    marqueurProvisoire.current = L.marker(
      [provisoire.latitude, provisoire.longitude],
      {
        icon: L.divIcon({
          className: "",
          html: pastilleProvisoire(),
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
        zIndexOffset: 2000,
      }
    ).addTo(map);
    map.setView([provisoire.latitude, provisoire.longitude], Math.max(map.getZoom(), 15));
  }, [provisoire, pret]);

  // --- Recadrage sur le point sélectionné ---
  useEffect(() => {
    const map = carte.current;
    if (!map || selectionId == null) return;
    const point = points.find((p) => p.id === selectionId);
    if (point) map.setView([point.latitude, point.longitude], Math.max(map.getZoom(), 15));
  }, [selectionId, points, pret]);

  return (
    <div
      ref={conteneur}
      className={cn(
        "z-0 h-full w-full rounded-2xl border bg-muted",
        onClicCarte && "cursor-crosshair",
        className
      )}
      role="application"
      aria-label="Carte des points prospectés"
    />
  );
}

/**
 * Contenu de la bulle d'un marqueur : identité du point et lien direct vers
 * l'application de navigation, pour partir sur place sans quitter la carte.
 */
function bulleItineraire(point: PointVente, statut: string): string {
  const apple = estAppareilApple();
  const url = lienItineraire(point.latitude, point.longitude, { apple });
  const application = apple ? "Apple Plans" : "Google Maps";
  const adresse = point.adresse
    ? `<div style="color:#64748b;margin-top:2px">${echapper(point.adresse)}</div>`
    : "";
  const tel = point.contact_tel
    ? `<a href="tel:${echapper(point.contact_tel)}" style="display:block;margin-top:6px;color:#0f172a">📞 ${echapper(point.contact_tel)}</a>`
    : "";

  return `
    <div style="min-width:170px;font-size:13px;line-height:1.35">
      <strong style="font-size:14px">${echapper(point.nom)}</strong>
      <div style="color:#64748b;margin-top:2px">${echapper(statut)}</div>
      ${adresse}${tel}
      <a href="${url}" target="_blank" rel="noreferrer"
         style="display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:6px 10px;
                border-radius:8px;background:#f97316;color:#fff;font-weight:500;text-decoration:none">
        ➤ Itinéraire
      </a>
      <div style="color:#94a3b8;margin-top:6px;font-size:11px">Ouvre ${application}</div>
    </div>`;
}

/** Pastille colorée du marqueur. Le halo signale une relance en retard. */
function pastille(hex: string, actif: boolean, enRetard: boolean): string {
  const anneau = actif ? "3px solid #0f172a" : "2px solid #ffffff";
  const halo = enRetard
    ? "0 0 0 4px rgba(249,115,22,.35), 0 1px 4px rgba(0,0,0,.4)"
    : "0 1px 4px rgba(0,0,0,.4)";
  return `<span style="display:block;width:26px;height:26px;border-radius:9999px;background:${hex};border:${anneau};box-shadow:${halo}"></span>`;
}

function pastilleProvisoire(): string {
  return `<span style="display:block;width:30px;height:30px;border-radius:9999px;background:rgba(249,115,22,.3);border:3px dashed #f97316;animation:none"></span>`;
}

/** Les noms saisis par les commerciaux vont dans du HTML : on les neutralise. */
function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}
