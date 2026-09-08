"use client";

/**
 * L'espace de travail d'un chantier : barre laterale avec commutateur de
 * projet, entete partagee — communs a tous les ecrans qui portent sur CE
 * chantier.
 */

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { EspaceChantiers } from "@/chantiers/composants/espace-chantiers";
import { Alerte, Chargement } from "@/chantiers/composants/ui";
import { chantiers, ErreurChantiers } from "@/chantiers/lib/api";
import type { Projet } from "@/chantiers/lib/types";

export default function LayoutChantier({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const projetId = Number(id);

  const [projet, setProjet] = useState<Projet | null>(null);
  const [projets, setProjets] = useState<Projet[]>([]);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    setProjet(null);
    setErreur("");
    Promise.all([chantiers.projet(projetId), chantiers.projets()])
      .then(([unique, page]) => {
        setProjet(unique);
        setProjets(page.results);
      })
      .catch((probleme) =>
        setErreur(
          probleme instanceof ErreurChantiers && probleme.statut === 404
            ? "Ce chantier n'existe pas ou ne vous est pas accessible."
            : "Le service ne repond pas.",
        ),
      );
  }, [projetId]);

  if (erreur) {
    return (
      <EspaceChantiers>
        <div className="mx-auto max-w-3xl">
          <Alerte>{erreur}</Alerte>
        </div>
      </EspaceChantiers>
    );
  }

  if (!projet) {
    return (
      <EspaceChantiers>
        <Chargement />
      </EspaceChantiers>
    );
  }

  return (
    <EspaceChantiers projet={projet} projets={projets}>
      <div className="mx-auto max-w-5xl">{children}</div>
    </EspaceChantiers>
  );
}
