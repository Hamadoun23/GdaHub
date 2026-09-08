"use client";

/** Liste des clients — ClientController::index. */

import Link from "next/link";
import { useEffect, useState } from "react";

import { Alerte, Bouton, Cellule, CLASSE_ENTREE, Carte, Champ, Chargement, EnTetePagePlanning, EtatVide, LigneTableau, Tableau } from "@/planning/composants/ui";
import { planning, ErreurPlanning } from "@/planning/lib/api";
import type { ClientPlanning } from "@/planning/lib/types";

export default function PageClientsPlanning() {
  const [clients, setClients] = useState<ClientPlanning[] | null>(null);
  const [erreur, setErreur] = useState("");
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);

  const charger = () => {
    planning
      .clients()
      .then((page) => setClients(page.results))
      .catch((probleme) => setErreur(probleme instanceof ErreurPlanning ? probleme.message : "La liste des clients ne répond pas."));
  };

  useEffect(charger, []);

  const creer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim()) return;
    setEnregistrement(true);
    try {
      await planning.creerClient(nom.trim());
      setNom("");
      setFormulaireOuvert(false);
      charger();
    } catch (probleme) {
      setErreur(probleme instanceof ErreurPlanning ? probleme.message : "La création a échoué.");
    } finally {
      setEnregistrement(false);
    }
  };

  return (
    <div>
      <EnTetePagePlanning
        titre="Clients"
        sousTitre="Entreprises suivies pour leur planning de contenu"
        actions={<Bouton onClick={() => setFormulaireOuvert((o) => !o)}>+ Nouveau client</Bouton>}
      />

      {erreur ? <Alerte>{erreur}</Alerte> : null}

      {formulaireOuvert ? (
        <Carte>
          <form onSubmit={creer} className="flex flex-wrap items-end gap-3">
            <div className="flex-1">
              <Champ label="Nom de l'entreprise">
                <input value={nom} onChange={(e) => setNom(e.target.value)} className={CLASSE_ENTREE} autoFocus />
              </Champ>
            </div>
            <Bouton type="submit" disabled={enregistrement}>
              {enregistrement ? "Création..." : "Créer"}
            </Bouton>
          </form>
        </Carte>
      ) : null}

      {!clients ? (
        <Chargement />
      ) : clients.length === 0 ? (
        <EtatVide>Aucun client pour l&apos;instant.</EtatVide>
      ) : (
        <Carte sansPadding>
          <Tableau entetes={["Entreprise", "Tournages", "Publications", "Actions"]} sansCadre>
            {clients.map((c) => (
              <LigneTableau key={c.id}>
                <Cellule className="font-medium">{c.nom_entreprise}</Cellule>
                <Cellule>{c.tournages_count}</Cellule>
                <Cellule>{c.publications_count}</Cellule>
                <Cellule>
                  <Link href={`/planning/clients/${c.id}`} className="text-sm font-medium text-primary hover:underline">
                    Voir le planning →
                  </Link>
                </Cellule>
              </LigneTableau>
            ))}
          </Tableau>
        </Carte>
      )}
    </div>
  );
}
