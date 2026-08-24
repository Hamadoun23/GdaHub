"use client";

/**
 * Module Jus d'Orange.
 *
 * L'écran suit la chaîne dans son ordre réel — cueillette, réception, stock,
 * production, bouteilles, encaissement — parce que c'est ainsi que le
 * responsable de production la parcourt. Les alertes remontent en tête : un
 * stock sous seuil, un lot périmé ou un écart de caisse ne peuvent pas
 * attendre qu'on pense à aller les chercher.
 */

import { useState } from "react";

import { Coquille } from "@/composants/Coquille";
import {
  Alerte,
  Badge,
  Carte,
  Chargement,
  EnTetePage,
  EtatVide,
  Grille,
  LigneListe,
  ListeLignes,
  Onglets,
  Statistique,
} from "@/composants/ui";
import { date, montant, nombre } from "@/lib/format";
import { useListe, useRessource } from "@/lib/ressources";

type TableauOrange = {
  oranges_en_stock: number;
  receptions_du_mois: number;
  productions_en_cours: number;
  bouteilles_disponibles: number;
  bouteilles_perimees: number;
  factures_impayees: number;
  ecarts_de_caisse: number;
  articles_sous_alerte: number;
};

type Article = {
  id: number;
  type_article: string;
  type_article_libelle: string;
  quantite: number;
  seuil_alerte: number;
  sous_alerte: boolean;
};

type Reception = {
  id: number;
  numero: string;
  origine: string;
  date_reception: string;
  quantite_recue: number;
  quantite_bonne: number;
  quantite_mauvaise: number;
  taux_qualite: number;
  etat_qualite: string;
};

type ProductionLigne = {
  id: number;
  numero: string;
  date_production: string;
  recette_libelle: string;
  statut: string;
  statut_libelle: string;
  volume_final_l: number;
  controles_complets: boolean;
  test_qualite: string;
};

type FactureLigne = {
  id: number;
  numero: string;
  date_facture: string;
  date_echeance: string;
  montant: number;
  montant_regle: number;
  reste_a_payer: number;
  statut_libelle: string;
};

type EcartLigne = {
  id: number;
  montant_declare: number;
  montant_recu: number;
  ecart: number;
  date_reception: string;
  statut_libelle: string;
  observation: string;
};

export default function PageJusOrange() {
  return (
    <Coquille>
      <Contenu />
    </Coquille>
  );
}

function Contenu() {
  const [onglet, setOnglet] = useState<
    "chaine" | "stock" | "production" | "recouvrement"
  >("chaine");

  const tableau = useRessource<TableauOrange>("/orange/tableau-de-bord");
  const articles = useListe<Article>(
    onglet === "stock" ? "/orange/articles?taille=50" : null,
  );
  const receptions = useListe<Reception>(
    onglet === "chaine" ? "/orange/receptions?taille=20" : null,
  );
  const productions = useListe<ProductionLigne>(
    onglet === "production" ? "/orange/productions?taille=30" : null,
  );
  const impayees = useListe<FactureLigne>(
    onglet === "recouvrement" ? "/orange/factures/impayees" : null,
  );
  const ecarts = useListe<EcartLigne>(
    onglet === "recouvrement" ? "/orange/receptions-paiement/ecarts" : null,
  );

  const chiffres = tableau.donnees;

  return (
    <>
      <EnTetePage
        titre="Jus d'Orange"
        description="De la cueillette à l'encaissement : stock, production, distribution."
      />

      {chiffres &&
      (chiffres.articles_sous_alerte ||
        chiffres.bouteilles_perimees ||
        chiffres.ecarts_de_caisse) ? (
        <div className="mb-6 space-y-2">
          {chiffres.articles_sous_alerte ? (
            <Alerte ton="avertissement" titre="Stock sous seuil">
              {chiffres.articles_sous_alerte} article(s) à réapprovisionner.
            </Alerte>
          ) : null}
          {chiffres.bouteilles_perimees ? (
            <Alerte titre="Bouteilles périmées">
              {chiffres.bouteilles_perimees} bouteille(s) encore marquées
              disponibles avec une date limite dépassée. Elles doivent être
              retirées du stock.
            </Alerte>
          ) : null}
          {chiffres.ecarts_de_caisse ? (
            <Alerte titre="Écarts de caisse non traités">
              {chiffres.ecarts_de_caisse} encaissement(s) où le montant reçu ne
              correspond pas au montant déclaré.
            </Alerte>
          ) : null}
        </div>
      ) : null}

      <div className="mb-6">
        <Grille colonnes={4}>
          <Statistique
            libelle="Oranges en stock"
            valeur={nombre(chiffres?.oranges_en_stock)}
            unite="kg"
          />
          <Statistique
            libelle="Reçu ce mois-ci"
            valeur={nombre(chiffres?.receptions_du_mois)}
            unite="kg"
          />
          <Statistique
            libelle="Bouteilles disponibles"
            valeur={nombre(chiffres?.bouteilles_disponibles)}
          />
          <Statistique
            libelle="Factures impayées"
            valeur={chiffres?.factures_impayees ?? 0}
            ton={chiffres?.factures_impayees ? "alerte" : "succes"}
          />
        </Grille>
      </div>

      <Onglets
        onglets={[
          { cle: "chaine" as const, libelle: "Réceptions" },
          { cle: "stock" as const, libelle: "Stock" },
          { cle: "production" as const, libelle: "Production" },
          {
            cle: "recouvrement" as const,
            libelle: "Recouvrement",
            compteur: chiffres?.factures_impayees ?? 0,
          },
        ]}
        actif={onglet}
        onChange={setOnglet}
      />

      {onglet === "chaine" ? (
        <Carte
          titre="Dernières réceptions"
          sousTitre="La qualité se juge sur la part perdue à l'arrivée."
          sansPadding
        >
          <div className="px-4 sm:px-5">
            {receptions.chargement ? (
              <Chargement />
            ) : receptions.erreur ? (
              <div className="py-5">
                <Alerte>{receptions.erreur}</Alerte>
              </div>
            ) : !receptions.donnees?.length ? (
              <EtatVide titre="Aucune réception" />
            ) : (
              <ListeLignes>
                {receptions.donnees.map((reception) => (
                  <LigneListe
                    key={reception.id}
                    titre={`${reception.numero} — ${reception.origine}`}
                    detail={
                      <>
                        {date(reception.date_reception)} ·{" "}
                        {nombre(reception.quantite_bonne)} kg retenus sur{" "}
                        {nombre(reception.quantite_recue)} ·{" "}
                        {nombre(reception.quantite_mauvaise)} kg perdus
                      </>
                    }
                    valeur={`${reception.taux_qualite} %`}
                    statut={
                      <Badge
                        ton={
                          reception.etat_qualite === "EXCELLENT"
                            ? "succes"
                            : reception.etat_qualite === "BON"
                              ? "alerte"
                              : "danger"
                        }
                      >
                        {reception.etat_qualite}
                      </Badge>
                    }
                  />
                ))}
              </ListeLignes>
            )}
          </div>
        </Carte>
      ) : null}

      {onglet === "stock" ? (
        <Carte sansPadding>
          <div className="px-4 sm:px-5">
            {articles.chargement ? (
              <Chargement />
            ) : !articles.donnees?.length ? (
              <EtatVide titre="Stock vide" />
            ) : (
              <ListeLignes>
                {articles.donnees.map((article) => (
                  <LigneListe
                    key={article.id}
                    titre={article.type_article_libelle}
                    detail={`Seuil d'alerte : ${nombre(article.seuil_alerte)}`}
                    valeur={nombre(article.quantite)}
                    statut={
                      article.sous_alerte ? (
                        <Badge ton="alerte">À réapprovisionner</Badge>
                      ) : (
                        <Badge ton="succes">Suffisant</Badge>
                      )
                    }
                  />
                ))}
              </ListeLignes>
            )}
          </div>
        </Carte>
      ) : null}

      {onglet === "production" ? (
        <Carte
          titre="Ordres de fabrication"
          sousTitre="Une production ne se termine pas sans ses trois contrôles sanitaires."
          sansPadding
        >
          <div className="px-4 sm:px-5">
            {productions.chargement ? (
              <Chargement />
            ) : !productions.donnees?.length ? (
              <EtatVide titre="Aucune production" />
            ) : (
              <ListeLignes>
                {productions.donnees.map((production) => (
                  <LigneListe
                    key={production.id}
                    titre={`${production.numero} — ${production.recette_libelle}`}
                    detail={
                      <>
                        {date(production.date_production)} ·{" "}
                        {nombre(production.volume_final_l)} L
                        {production.test_qualite
                          ? ` · test ${production.test_qualite.toLowerCase()}`
                          : ""}
                      </>
                    }
                    valeur={
                      production.controles_complets ? (
                        <Badge ton="succes">Contrôles faits</Badge>
                      ) : (
                        <Badge ton="alerte">Contrôles incomplets</Badge>
                      )
                    }
                    statut={<Badge>{production.statut_libelle}</Badge>}
                  />
                ))}
              </ListeLignes>
            )}
          </div>
        </Carte>
      ) : null}

      {onglet === "recouvrement" ? (
        <div className="space-y-6">
          <Carte
            titre="Factures à encaisser"
            sousTitre="Échéance la plus ancienne en tête."
            sansPadding
          >
            <div className="px-4 sm:px-5">
              {impayees.chargement ? (
                <Chargement />
              ) : !impayees.donnees?.length ? (
                <EtatVide
                  titre="Rien à encaisser"
                  description="Toutes les factures sont soldées."
                />
              ) : (
                <ListeLignes>
                  {impayees.donnees.map((facture) => (
                    <LigneListe
                      key={facture.id}
                      titre={facture.numero}
                      detail={
                        <>
                          Échéance {date(facture.date_echeance)} · réglé{" "}
                          {montant(facture.montant_regle)} sur{" "}
                          {montant(facture.montant)}
                        </>
                      }
                      valeur={montant(facture.reste_a_payer)}
                      statut={<Badge ton="alerte">{facture.statut_libelle}</Badge>}
                    />
                  ))}
                </ListeLignes>
              )}
            </div>
          </Carte>

          <Carte
            titre="Écarts de caisse"
            sousTitre="Le commercial déclare, la trésorerie constate."
            sansPadding
          >
            <div className="px-4 sm:px-5">
              {ecarts.chargement ? (
                <Chargement />
              ) : !ecarts.donnees?.length ? (
                <EtatVide
                  titre="Aucun écart"
                  description="Les encaissements tombent juste."
                />
              ) : (
                <ListeLignes>
                  {ecarts.donnees.map((ecart) => (
                    <LigneListe
                      key={ecart.id}
                      titre={`Déclaré ${montant(ecart.montant_declare)} · reçu ${montant(ecart.montant_recu)}`}
                      detail={
                        ecart.observation ||
                        `Constaté le ${date(ecart.date_reception)}`
                      }
                      valeur={montant(ecart.ecart)}
                      statut={<Badge ton="danger">{ecart.statut_libelle}</Badge>}
                    />
                  ))}
                </ListeLignes>
              )}
            </div>
          </Carte>
        </div>
      ) : null}
    </>
  );
}
