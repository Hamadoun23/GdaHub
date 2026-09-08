"use client";

import { Icone } from "@/rh/composants/icones";
import { EnTetePage, TuileStat } from "@/rh/composants/ui";
import { useAuth } from "@/rh/lib/auth";
import { date, nombre } from "@/rh/lib/format";
import { useRessource } from "@/rh/lib/hooks";
import type { SoldeConge } from "@/rh/lib/types";

/**
 * Mon espace RH.
 *
 * Ni identite ni mot de passe ici : les deux se gerent une fois pour toutes
 * au niveau du hub — « Mon compte » — et nulle part ailleurs, y compris le
 * mot de passe local a FinanceRH que cette page a longtemps permis de
 * changer. Un compte, une seule vraie porte pour y toucher : c'est la
 * demande explicite de l'utilisateur, applicable a toutes les applications
 * du hub. Ne reste ici que ce qu'aucune autre application ne connait : le
 * solde de conges, l'anciennete, le contrat.
 */
export default function PageMonEspace() {
  const { utilisateur } = useAuth();
  const solde = useRessource<SoldeConge>("/soldes-conges/mon-solde/");

  if (!utilisateur) return null;

  return (
    <>
      <EnTetePage titre="Mon espace" description="Votre situation aupres de FinanceRH." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 max-sm:[&>*:last-child]:col-span-2">
        <TuileStat
          libelle="Solde de conges"
          valeur={`${nombre(solde.donnees?.jours_restants, 1)} j`}
          detail={`${nombre(solde.donnees?.jours_pris, 1)} j deja pris`}
          ton="marque"
          icone={<Icone nom="conge" />}
        />
        <TuileStat
          libelle="Anciennete"
          valeur={`${Math.floor(utilisateur.anciennete_mois / 12)} an(s)`}
          detail={
            utilisateur.date_embauche
              ? `Depuis le ${date(utilisateur.date_embauche)}`
              : "Date d'embauche non renseignee"
          }
          icone={<Icone nom="indicateur" />}
        />
        <TuileStat
          libelle="Type de contrat"
          valeur={utilisateur.type_contrat}
          detail={utilisateur.departement_nom || "Departement non affecte"}
          ton="info"
          icone={<Icone nom="profil" />}
        />
      </div>
    </>
  );
}
