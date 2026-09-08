"use client";

/** Galerie photo du chantier : televersement par categorie, suppression. */

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Alerte, BoutonChantier, Carte, Chargement } from "@/chantiers/composants/ui";
import { chantiers, ErreurChantiers } from "@/chantiers/lib/api";
import type { Photo } from "@/chantiers/lib/types";

const CATEGORIES = [
  { valeur: "avant", libelle: "Avant" },
  { valeur: "pendant", libelle: "Pendant" },
  { valeur: "apres", libelle: "Apres" },
  { valeur: "securite", libelle: "Securite" },
  { valeur: "qualite", libelle: "Qualite" },
];

export default function PagePhotos() {
  const { id } = useParams<{ id: string }>();
  const projetId = Number(id);
  const entreeFichier = useRef<HTMLInputElement>(null);

  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [categorie, setCategorie] = useState("pendant");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const charger = () => {
    chantiers
      .photos(projetId)
      .then((page) => setPhotos(page.results))
      .catch((probleme) =>
        setErreur(probleme instanceof ErreurChantiers ? probleme.message : "La galerie ne repond pas."),
      );
  };

  useEffect(charger, [projetId]);

  async function surChoixFichier(evenement: React.ChangeEvent<HTMLInputElement>) {
    const fichier = evenement.target.files?.[0];
    evenement.target.value = "";
    if (!fichier) return;
    setEnvoi(true);
    setErreur("");
    try {
      await chantiers.televerserPhoto(projetId, fichier, categorie);
      charger();
    } catch (probleme) {
      setErreur(probleme instanceof ErreurChantiers ? probleme.message : "Envoi impossible.");
    } finally {
      setEnvoi(false);
    }
  }

  async function supprimer(photoId: number) {
    try {
      await chantiers.supprimerPhoto(photoId, projetId);
      setPhotos((actuelles) => (actuelles ? actuelles.filter((p) => p.id !== photoId) : actuelles));
    } catch {
      setErreur("Suppression impossible.");
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-[28px] font-bold uppercase tracking-wide text-foreground sm:text-[36px]">
        Galerie photos
      </h1>

      <Carte>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block w-48">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Categorie
            </span>
            <select
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {CATEGORIES.map((c) => (
                <option key={c.valeur} value={c.valeur}>
                  {c.libelle}
                </option>
              ))}
            </select>
          </label>
          <BoutonChantier variante="discret" disabled={envoi} onClick={() => entreeFichier.current?.click()}>
            {envoi ? "Envoi..." : "Ajouter une photo"}
          </BoutonChantier>
          <input ref={entreeFichier} type="file" accept="image/*" className="hidden" onChange={surChoixFichier} />
        </div>
      </Carte>

      {erreur ? <Alerte>{erreur}</Alerte> : null}

      {photos === null ? (
        <Chargement />
      ) : photos.length === 0 ? (
        <Carte>
          <p className="py-8 text-center text-sm text-muted-foreground">
            Aucune photo. Les photos televersees apparaitront ici, par categorie.
          </p>
        </Carte>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <figure
              key={photo.id}
              className="group relative overflow-hidden rounded-lg border border-border"
            >
              {/* Image ordinaire : la galerie n'a pas besoin du pipeline d'optimisation. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={photo.caption || photo.category_display} className="aspect-square w-full object-cover" />
              <figcaption className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-xs text-white">
                {photo.category_display}
              </figcaption>
              <button
                type="button"
                onClick={() => supprimer(photo.id)}
                aria-label="Supprimer"
                className="absolute right-1 top-1 rounded-md bg-black/60 px-1.5 py-0.5 text-xs text-white opacity-0 transition group-hover:opacity-100"
              >
                Supprimer
              </button>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
