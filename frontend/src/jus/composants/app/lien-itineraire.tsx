"use client";

import { useEffect, useState } from "react";
import { Navigation } from "lucide-react";
import { buttonVariants } from "@/ui/button";
import { estAppareilApple, lienItineraire } from "@/jus/lib/prospection";
import { cn } from "@/lib/cn";

/**
 * Bouton « Itinéraire » : ouvre l'application de navigation du téléphone,
 * cap sur le point de vente.
 *
 * Le premier rendu vise toujours Google Maps, y compris côté serveur : lire
 * `navigator` pendant le rendu provoquerait une différence entre le HTML
 * envoyé et celui reconstruit par React. La bascule vers Apple Plans se fait
 * après montage, sur les appareils Apple uniquement.
 */
export function LienItineraire({
  latitude,
  longitude,
  variante = "outline",
  taille = "sm",
  className,
  libelle = "Itinéraire",
}: {
  latitude: number;
  longitude: number;
  variante?: "outline" | "default" | "ghost" | "secondary";
  taille?: "sm" | "default" | "lg";
  className?: string;
  libelle?: string;
}) {
  const [apple, setApple] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (estAppareilApple()) setApple(true);
  }, []);

  return (
    <a
      href={lienItineraire(latitude, longitude, { apple })}
      target="_blank"
      rel="noreferrer"
      className={cn(
        buttonVariants({ variant: variante, size: taille }),
        "gap-2",
        className
      )}
      title={
        apple
          ? "Ouvrir l'itinéraire dans Apple Plans"
          : "Ouvrir l'itinéraire dans Google Maps"
      }
    >
      <Navigation className="size-4" />
      {libelle}
    </a>
  );
}
