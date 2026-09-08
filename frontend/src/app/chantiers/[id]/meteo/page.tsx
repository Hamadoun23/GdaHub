"use client";

/**
 * Previsions meteo du chantier.
 *
 * Version simplifiee de l'original : celui-ci calcule un verdict travaux
 * (bon/prudence/mauvais) et une timeline horaire a partir de seuils
 * configures cote serveur (vent, pluie, temperature). Cette logique n'est
 * pas reprise ici — l'ecran affiche les previsions brutes d'Open-Meteo,
 * suffisant pour decider a l'oeil, mais sans le moteur d'alertes.
 */

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Alerte, BoutonChantier, Carte, Chargement } from "@/chantiers/composants/ui";
import { chantiers, ErreurChantiers } from "@/chantiers/lib/api";

const DESCRIPTIONS_WMO: Record<number, { emoji: string; texte: string }> = {
  0: { emoji: "☀️", texte: "Ciel degage" },
  1: { emoji: "🌤️", texte: "Peu nuageux" },
  2: { emoji: "⛅", texte: "Partiellement nuageux" },
  3: { emoji: "☁️", texte: "Couvert" },
  45: { emoji: "🌫️", texte: "Brouillard" },
  48: { emoji: "🌫️", texte: "Brouillard givrant" },
  51: { emoji: "🌦️", texte: "Bruine legere" },
  61: { emoji: "🌧️", texte: "Pluie legere" },
  63: { emoji: "🌧️", texte: "Pluie moderee" },
  65: { emoji: "🌧️", texte: "Pluie forte" },
  80: { emoji: "🌦️", texte: "Averses" },
  95: { emoji: "⛈️", texte: "Orage" },
  96: { emoji: "⛈️", texte: "Orage avec grele" },
};

function description(code: number) {
  return DESCRIPTIONS_WMO[code] ?? { emoji: "🌡️", texte: "Conditions variables" };
}

type Previsions = Awaited<ReturnType<typeof chantiers.meteo>>;

export default function PageMeteo() {
  const { id } = useParams<{ id: string }>();
  const projetId = Number(id);

  const [previsions, setPrevisions] = useState<Previsions | null>(null);
  const [erreur, setErreur] = useState("");
  const [ville, setVille] = useState("");

  function charger(lat: number, lon: number) {
    setErreur("");
    chantiers
      .meteo(lat, lon)
      .then(setPrevisions)
      .catch((probleme) =>
        setErreur(probleme instanceof ErreurChantiers ? probleme.message : "Le service meteo ne repond pas."),
      );
  }

  useEffect(() => {
    if (!navigator.geolocation) {
      // A defaut de localisation, Bamako — le siege du groupe.
      charger(12.6392, -8.0029);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => charger(position.coords.latitude, position.coords.longitude),
      () => charger(12.6392, -8.0029),
      { timeout: 5000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetId]);

  async function rechercherVille(evenement: React.FormEvent) {
    evenement.preventDefault();
    if (!ville.trim()) return;
    try {
      const { results } = await chantiers.geocoder(ville.trim());
      if (results[0]) charger(results[0].latitude, results[0].longitude);
      else setErreur("Ville introuvable.");
    } catch {
      setErreur("Recherche impossible.");
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-[28px] font-bold uppercase tracking-wide text-foreground sm:text-[36px]">
          Previsions meteo
        </h1>
        <form onSubmit={rechercherVille} className="flex gap-2">
          <input
            value={ville}
            onChange={(e) => setVille(e.target.value)}
            placeholder="Rechercher une ville..."
            className="rounded-md border border-border px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
          <BoutonChantier type="submit" variante="discret">
            Rechercher
          </BoutonChantier>
        </form>
      </div>

      {erreur ? <Alerte>{erreur}</Alerte> : null}

      {!previsions ? (
        <Chargement />
      ) : (
        <>
          <Carte>
            <div className="flex items-center gap-5">
              <span className="text-5xl">{description(previsions.current.weather_code).emoji}</span>
              <div>
                <p className="text-4xl font-extrabold text-foreground">
                  {Math.round(previsions.current.temperature_2m)}°C
                </p>
                <p className="text-sm text-muted-foreground">{description(previsions.current.weather_code).texte}</p>
              </div>
            </div>
          </Carte>

          <Carte titre="7 prochains jours" sansPadding>
            <ul className="divide-y divide-[#e8e4dc]">
              {previsions.daily.time.map((jour, i) => (
                <li key={jour} className="flex items-center gap-4 px-5 py-3">
                  <span className="w-24 shrink-0 text-sm font-semibold text-foreground">
                    {new Date(jour).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                  </span>
                  <span className="text-2xl">{description(previsions.daily.weather_code[i]).emoji}</span>
                  <span className="flex-1 text-sm text-muted-foreground">{description(previsions.daily.weather_code[i]).texte}</span>
                  <span className="text-sm text-sky-600">
                    💧 {previsions.daily.precipitation_probability_max[i]}%
                  </span>
                  <span className="w-20 shrink-0 text-right text-sm font-bold text-foreground">
                    {Math.round(previsions.daily.temperature_2m_max[i])}° / {Math.round(previsions.daily.temperature_2m_min[i])}°
                  </span>
                </li>
              ))}
            </ul>
          </Carte>
        </>
      )}
    </div>
  );
}
