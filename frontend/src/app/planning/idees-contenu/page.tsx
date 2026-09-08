"use client";

/** Idées de contenu, partagées entre tous les clients — ContentIdeaController. */

import { useEffect, useState } from "react";

import { Alerte, Bouton, Cellule, CLASSE_ENTREE, Carte, Champ, Chargement, EnTetePagePlanning, EtatVide, LigneTableau, Tableau } from "@/planning/composants/ui";
import { useRolePlanning } from "@/planning/composants/espace-planning";
import { planning, ErreurPlanning } from "@/planning/lib/api";
import type { IdeeContenu, TypeIdee } from "@/planning/lib/types";

const TYPES: { valeur: TypeIdee; libelle: string }[] = [
  { valeur: "vidéo", libelle: "Vidéo" },
  { valeur: "image", libelle: "Image" },
  { valeur: "texte", libelle: "Texte" },
];

export default function PageIdeesContenu() {
  const { peutEcrire } = useRolePlanning();
  const [idees, setIdees] = useState<IdeeContenu[] | null>(null);
  const [erreur, setErreur] = useState("");
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [titre, setTitre] = useState("");
  const [type, setType] = useState<TypeIdee>("vidéo");
  const [enregistrement, setEnregistrement] = useState(false);
  const [enEdition, setEnEdition] = useState<number | null>(null);

  const charger = () => {
    planning
      .idees()
      .then((page) => setIdees(page.results))
      .catch((probleme) => setErreur(probleme instanceof ErreurPlanning ? probleme.message : "La liste ne répond pas."));
  };

  useEffect(charger, []);

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titre.trim()) return;
    setEnregistrement(true);
    try {
      if (enEdition) await planning.modifierIdee(enEdition, { titre: titre.trim(), type });
      else await planning.creerIdee({ titre: titre.trim(), type });
      setTitre("");
      setType("vidéo");
      setEnEdition(null);
      setFormulaireOuvert(false);
      charger();
    } catch (probleme) {
      setErreur(probleme instanceof ErreurPlanning ? probleme.message : "L'enregistrement a échoué.");
    } finally {
      setEnregistrement(false);
    }
  };

  const editer = (idee: IdeeContenu) => {
    setEnEdition(idee.id);
    setTitre(idee.titre);
    setType(idee.type);
    setFormulaireOuvert(true);
  };

  const supprimer = async (id: number) => {
    await planning.supprimerIdee(id);
    charger();
  };

  return (
    <div>
      <EnTetePagePlanning
        titre="Idées de contenu"
        sousTitre="Partagées entre tous les clients"
        actions={
          peutEcrire ? (
            <Bouton
              onClick={() => {
                setEnEdition(null);
                setTitre("");
                setType("vidéo");
                setFormulaireOuvert((o) => !o);
              }}
            >
              + Nouvelle idée
            </Bouton>
          ) : undefined
        }
      />

      {erreur ? <Alerte>{erreur}</Alerte> : null}

      {formulaireOuvert ? (
        <Carte>
          <form onSubmit={soumettre} className="flex flex-wrap items-end gap-3">
            <div className="flex-1">
              <Champ label="Titre">
                <input value={titre} onChange={(e) => setTitre(e.target.value)} className={CLASSE_ENTREE} autoFocus />
              </Champ>
            </div>
            <Champ label="Type">
              <select value={type} onChange={(e) => setType(e.target.value as TypeIdee)} className={CLASSE_ENTREE}>
                {TYPES.map((t) => (
                  <option key={t.valeur} value={t.valeur}>
                    {t.libelle}
                  </option>
                ))}
              </select>
            </Champ>
            <Bouton type="submit" disabled={enregistrement}>
              {enregistrement ? "Enregistrement..." : enEdition ? "Modifier" : "Créer"}
            </Bouton>
          </form>
        </Carte>
      ) : null}

      {!idees ? (
        <Chargement />
      ) : idees.length === 0 ? (
        <EtatVide>Aucune idée de contenu.</EtatVide>
      ) : (
        <Carte sansPadding>
          <Tableau entetes={peutEcrire ? ["Titre", "Type", "Actions"] : ["Titre", "Type"]} sansCadre>
            {idees.map((idee) => (
              <LigneTableau key={idee.id}>
                <Cellule className="font-medium">{idee.titre}</Cellule>
                <Cellule className="capitalize">{idee.type}</Cellule>
                {peutEcrire ? (
                  <Cellule>
                    <div className="flex gap-3 text-sm font-medium">
                      <button type="button" onClick={() => editer(idee)} className="text-primary hover:underline">
                        Modifier
                      </button>
                      <button type="button" onClick={() => supprimer(idee.id)} className="text-destructive hover:underline">
                        Supprimer
                      </button>
                    </div>
                  </Cellule>
                ) : null}
              </LigneTableau>
            ))}
          </Tableau>
        </Carte>
      )}
    </div>
  );
}
