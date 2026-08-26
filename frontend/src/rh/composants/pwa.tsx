"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { useEnLigne, useValeurNavigateur } from "@/rh/lib/hooks";
import { CHEMIN_BASE, chemin } from "@/rh/lib/chemin-base";

/**
 * Le pont entre l'application et le navigateur-hote : agent de service,
 * proposition d'installation, etat du reseau.
 *
 * Ces trois sujets partagent le meme fichier parce qu'ils partagent la meme
 * scene — une pile de messages en bas d'ecran — et qu'aucun ne justifie a lui
 * seul un composant. Le bas plutot que le haut : c'est la ou le pouce arrive,
 * et la barre superieure de l'application n'est jamais recouverte.
 */

/** Evenement Chromium qui permet de declencher l'installation nous-memes. */
interface EvenementInstallation extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    /** Depose par le script d'amorce du gabarit racine. */
    __gdaInstallation?: EvenementInstallation | null;
  }
}

const CLE_REFUS = "gda_installation_refusee";

export function Pwa() {
  return (
    <div
      className={[
        // La pile laisse passer les clics : seules les cartes qu'elle porte
        // les interceptent.
        "pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-3",
        // Au-dessus de la barre de navigation basse sur telephone ; dans le
        // coin sur les grands ecrans, ou cette barre n'existe pas.
        "bottom-[calc(env(safe-area-inset-bottom)+4.75rem)]",
        "lg:inset-x-auto lg:right-6 lg:bottom-6 lg:items-end lg:px-0",
      ].join(" ")}
    >
      <BandeauReseau />
      <AgentDeService />
      <InvitationInstallation />
    </div>
  );
}

// --- Agent de service ------------------------------------------------------

function AgentDeService() {
  const [enAttente, setEnAttente] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // En developpement, les fragments de code changent a chaque frappe : un
    // cache « d'abord la copie locale » y servirait du code perime. On
    // desinscrit meme l'agent, au cas ou une visite en production aurait
    // laisse le sien sur la meme origine.
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((inscriptions) => inscriptions.forEach((i) => void i.unregister()));
      return;
    }

    let annule = false;

    void navigator.serviceWorker
      .register(chemin("/sw.js"), {
        // La portee borne ce que l'agent controle : sous la passerelle
        // du hub, il ne doit pas repondre pour les autres applications.
        scope: `${CHEMIN_BASE}/`,
        updateViaCache: "none",
      })
      .then((inscription) => {
        if (annule) return;

        const surveiller = (agent: ServiceWorker | null) => {
          // Un agent « installe » alors qu'un autre controle deja la page :
          // une version neuve attend son tour.
          if (agent && navigator.serviceWorker.controller) setEnAttente(agent);
        };

        surveiller(inscription.waiting);
        inscription.addEventListener("updatefound", () => {
          const arrivant = inscription.installing;
          arrivant?.addEventListener("statechange", () => {
            if (arrivant.state === "installed") surveiller(arrivant);
          });
        });
      })
      .catch(() => undefined);

    // La bascule d'agent recharge la page : le code affiche et le code en
    // cache doivent venir de la meme version.
    let rechargement = false;
    const surBascule = () => {
      if (rechargement) return;
      rechargement = true;
      location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", surBascule);

    return () => {
      annule = true;
      navigator.serviceWorker.removeEventListener("controllerchange", surBascule);
    };
  }, []);

  if (!enAttente) return null;

  return (
    <div className="carte apparition pointer-events-auto flex w-full max-w-md items-center gap-3 p-3 shadow-lg lg:w-96">
      <p className="min-w-0 flex-1 text-sm text-slate-700">
        Une nouvelle version de l&apos;application est prete.
      </p>
      <button
        type="button"
        onClick={() => enAttente.postMessage("SAUTER_ATTENTE")}
        className="shrink-0 rounded-lg bg-marque-700 px-3 py-2 text-xs font-medium text-white transition hover:bg-marque-800"
      >
        Actualiser
      </button>
    </div>
  );
}

// --- Etat du reseau --------------------------------------------------------

function BandeauReseau() {
  const enLigne = useEnLigne();
  if (enLigne) return null;

  return (
    <div
      role="status"
      className="apparition pointer-events-auto flex items-center gap-2 rounded-full bg-amber-500 px-3.5 py-2 text-xs font-medium text-white shadow-lg"
    >
      <span className="size-1.5 rounded-full bg-white" aria-hidden="true" />
      Hors ligne — les envois attendront le retour du reseau.
    </div>
  );
}

// --- Invitation a installer ------------------------------------------------

/** iOS n'expose aucune API d'installation : il faut decrire le geste. */
function estIOS() {
  const agent = navigator.userAgent;
  return (
    /iphone|ipad|ipod/i.test(agent) ||
    // iPadOS se fait passer pour un Mac ; l'ecran tactile le trahit.
    (/macintosh/i.test(agent) && navigator.maxTouchPoints > 1)
  );
}

function dejaInstallee() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Propriete historique de Safari, absente des types du DOM.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function invitationRefusee() {
  try {
    return localStorage.getItem(CLE_REFUS) !== null;
  } catch {
    // Stockage refuse (navigation privee) : on propose quand meme.
    return false;
  }
}

/**
 * L'evenement d'installation, suivi la ou le navigateur le depose.
 *
 * Chrome l'emet des que le manifeste est lu — parfois avant l'hydratation. Le
 * script d'amorce du gabarit racine le met de cote dans `window`, qui devient
 * ainsi la source exterieure a laquelle React s'abonne.
 */
function souscrireInstallation(surChangement: () => void) {
  const surInvitation = (evenement: Event) => {
    evenement.preventDefault();
    window.__gdaInstallation = evenement as EvenementInstallation;
    surChangement();
  };
  const surInstallation = () => {
    window.__gdaInstallation = null;
    surChangement();
  };
  window.addEventListener("beforeinstallprompt", surInvitation);
  window.addEventListener("appinstalled", surInstallation);
  return () => {
    window.removeEventListener("beforeinstallprompt", surInvitation);
    window.removeEventListener("appinstalled", surInstallation);
  };
}

function InvitationInstallation() {
  const invitation = useSyncExternalStore(
    souscrireInstallation,
    () => window.__gdaInstallation ?? null,
    () => null,
  );
  const surIOS = useValeurNavigateur(estIOS, false);
  // Cote serveur, on part du principe que rien n'est a proposer : l'invitation
  // apparait apres hydratation plutot que de clignoter au chargement.
  const installee = useValeurNavigateur(dejaInstallee, true);
  const refusAncien = useValeurNavigateur(invitationRefusee, true);
  const [refusDuJour, setRefusDuJour] = useState(false);

  const refuser = useCallback(() => {
    setRefusDuJour(true);
    try {
      localStorage.setItem(CLE_REFUS, "1");
    } catch {
      // Sans stockage, l'invitation reviendra a la prochaine visite.
    }
  }, []);

  const installer = useCallback(async () => {
    if (!invitation) return;
    await invitation.prompt();
    await invitation.userChoice;
    // Une invitation ne se declenche qu'une fois : consommee, elle disparait.
    window.__gdaInstallation = null;
    setRefusDuJour(true);
  }, [invitation]);

  if (installee || refusAncien || refusDuJour) return null;
  // Sur iOS, faute d'API, on decrit le geste ; ailleurs, on attend que le
  // navigateur nous confie son invitation.
  if (!invitation && !surIOS) return null;

  return (
    <div className="carte apparition pointer-events-auto w-full max-w-md p-4 shadow-lg lg:w-96">
      <div className="flex items-start gap-3">
        {/* Image ordinaire : une icone de 40 px ne merite pas le pipeline
            d'optimisation, et l'invitation doit s'afficher sans latence. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icones/icone-192.png"
          alt=""
          className="size-10 shrink-0 rounded-lg border border-slate-200"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800">
            Installer GD&amp;A RH
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {invitation
              ? "Ouvrez l'application d'un geste, en plein ecran, sans passer par le navigateur."
              : "Touchez « Partager » en bas de Safari, puis « Sur l'ecran d'accueil »."}
          </p>
        </div>
        <button
          type="button"
          onClick={refuser}
          aria-label="Masquer l'invitation"
          className="-m-1 shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {invitation && (
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={refuser}
            className="rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100"
          >
            Plus tard
          </button>
          <button
            type="button"
            onClick={() => void installer()}
            className="rounded-lg bg-marque-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-marque-800"
          >
            Installer
          </button>
        </div>
      )}
    </div>
  );
}
