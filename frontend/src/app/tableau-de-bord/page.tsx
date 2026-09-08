"use client";

/**
 * Le point d'entree apres la connexion : les applications auxquelles ce compte
 * a droit, et ce qui y attend une action ou un regard.
 *
 * La liste des applications vient d'identity, sections comprises — Board
 * d'abord, le siege et son organigramme, puis les quatre applications
 * metier. Un compte sans habilitation voit une page vide et un message
 * explicite, plutot que des cartes grisees qui laisseraient croire a une
 * panne.
 *
 * Le widget « A faire » (composants/dashboard-hub/a-faire.tsx) montre de
 * vrais elements a traiter sur RH/Finance/Planning — jamais des statistiques
 * de connexion au hub : un premier essai les affichait (graphique de
 * connexions, activite de connexion), et l'utilisateur a explicitement
 * demande l'inverse, « les dash doivent montrer les truc à faire ou voir sur
 * les app... et non les donnée de login ». Ces composants de connexion
 * restent dans le depot (ils marchent, et pourraient nourrir un futur ecran
 * de suivi reserve aux administrateurs) mais ne sont plus importes ici.
 *
 * L'habillage (cartes sombres/claires contrastees, coins tres arrondis,
 * panneau translucide flottant) reprend une reference Pinterest fournie par
 * l'utilisateur.
 *
 * Deuxieme passe, a la demande explicite de l'utilisateur : « minimalise,
 * simple ». Deux blocs ont saute plutot que d'etre retouches :
 * - La carte sombre « Vue d'ensemble » melangeait trois chiffres sans rapport
 *   entre eux (nombre d'applications, sections, roles actifs) — aucun n'est
 *   une action a prendre, juste du remplissage a cote du vrai contenu utile.
 * - La grille de tuiles sombres, une par application, redisait exactement ce
 *   que la barre laterale affiche deja en permanence (Coquille.tsx construit
 *   les memes groupes via `grouper()`) : la meme information deux fois sur le
 *   meme ecran n'aide personne a aller plus vite vers son travail.
 * Elle est remplacee par une rangee de puces compactes (icone + nom), triees
 * par la meme section — l'acces rapide reste present pour les applications
 * qui n'alimentent jamais « A faire » (Chantiers, Campagnes, Jus d'Orange),
 * juste sans le poids visuel d'une carte pleine par application.
 * « A faire » devient le seul contenu qui compte vraiment sur cet ecran : il
 * informe (ce qui attend) et redirige (le lien vers l'application) en une
 * seule liste, ce que l'utilisateur a demande explicitement.
 *
 * Troisieme passe : habillage repris d'une reference "Virtus" (maquette de
 * gestionnaire de taches) fournie par l'utilisateur — a la demande explicite
 * « style seulement, contenu reel » (question posee, l'option qui aurait
 * reintroduit des chiffres fictifs comme un graphique de performance a ete
 * ecartee). Ajoute une carte sombre « Resume » (composants/dashboard-hub/
 * resume.tsx) qui reprend le motif carte-sombre-a-anneau de la reference,
 * mais nourrie par les memes elements reels que `AFaire` (meme hook partage
 * `utiliser-a-faire.ts`, un seul appel reseau) : total, part urgente,
 * repartition par application — jamais de pourcentage invente. Les lignes
 * de `AFaire` reprennent le badge circulaire colore de la reference. La
 * rangee de puces d'applications passe dans sa propre carte plutot que de
 * flotter nue sur le panneau, pour la coherence avec les deux autres cartes.
 *
 * Quatrieme passe, sur retour explicite « ça ressemble pas à la maquette » :
 * la premiere passe n'avait touche que des cartes d'accent sur un panneau
 * clair — la reference a un vrai canevas sombre sous des cartes blanches et
 * une carte orange vive. Le panneau devient un degrade sombre chaud (brun
 * fonce -> noir), repris de la charte graphique fournie par l'utilisateur
 * (`GdaHub/assets/login/gda poster1.jpg`, un visuel de marque GDA) plutot
 * qu'un gris neutre — les cartes claires (A faire, Vos applications) et la
 * carte orange (Urgent) flottent dessus, comme le blanc/noir contraste de la
 * reference. Ajoute `composants/dashboard-hub/urgent.tsx` (carte orange sur
 * l'element le plus urgent reel — n'apparait que s'il y en a un) et un
 * avatar d'initiales par ligne de `AFaire` (le nom reel de la personne/du
 * client, badge d'application en incrustation) plutot qu'une icone generique.
 * `Resume` passe d'un anneau+barres maison a un vrai graphique (recharts,
 * deja utilise par `graphique-connexions.tsx`) : un donut de la repartition
 * reelle par application — la reference voulait explicitement « un
 * graphique », mais aucune donnee de tendance dans le temps n'existe au
 * niveau du hub ; inventer une courbe de performance aurait ete exactement
 * l'ecart que l'utilisateur avait deja recale (« style seulement, contenu
 * reel »). La sidebar globale (composants/coquille-app/, partagee par Jus/
 * RH/Chantiers/Planning/Hub) n'est pas repassee en sombre : c'est du chrome
 * partage par les 5 applications, et le mode sombre du hub avait deja ete
 * retire explicitement une fois (voir memoire [[uniformisation-design-hub]])
 * — seul le canevas de CETTE page change.
 *
 * Cinquieme passe, sur retour explicite « je veux voir le fond blanc ni la
 * couleur orange [de marque], vas y sur la charte graphique du poster » :
 * les codes couleurs exacts du poster (extraits et documentes dans
 * `GdaHub/charte.md`, repris dans `composants/dashboard-hub/charte-poster.ts`)
 * remplacent partout le brand-orange (`--color-marque`) et les cartes
 * blanches — `AFaire` et « Vos applications » perdent `@/ui/card` (qui impose
 * un fond blanc en mode clair) au profit de degrades sombres codes en dur sur
 * la meme palette que le canevas et `Resume`. Le rouge « en retard » reste
 * seul rescape, comme couleur semantique d'alerte plutot que de marque (regle
 * deja appliquee au reste du hub pendant l'uniformisation). Sixieme et
 * septieme passes (le motif du poster remplace le degrade CSS comme fond,
 * puis devient transparent a travers la sidebar/l'entete aussi) : voir
 * `composants/Coquille.tsx`.
 *
 * Huitieme passe, sur retour explicite « le hub n'est pas en phase avec la
 * maquette » (le fond etait valide, la mise en page non) : la reference
 * alterne des cartes tres claires et tres sombres en mosaique dense — notre
 * version n'avait que deux cartes sombres plates sur un fond deja tres
 * colore, sans le contraste clair/sombre ni la densite de la reference.
 * Reorganise en deux rangees : rangee 1 = pile [Total + Urgent] a gauche,
 * Resume (sombre, donut) etire sur toute la hauteur a droite — le pendant du
 * bloc en L "3 petites cartes + grande carte sombre" de la reference. Rangee
 * 2 = A faire (clair, large) a gauche, Vos applications (sombre) plus etroit
 * a droite — le pendant de "Assignment for all team" (blanc, large) +
 * "Main goal" (sombre, etroit).
 *
 * Neuvieme passe, sur retour explicite « le design n'est pas top, il doit
 * ressembler exactement a la maquette » (comparaison directe cote a cote des
 * deux captures) : la teinte poster (jaune-lanterne, brun, motif plein cadre)
 * donnait un rendu monochrome orange/brun sans aucun blanc, alors que la
 * reference a un canevas CLAIR, des cartes franchement blanches, et le sombre
 * reserve a la sidebar + 1-2 cartes d'accent. Le panneau texture qui
 * enveloppait tout le tableau de bord est retire : les cartes flottent
 * directement sur le canevas clair de la coquille (`bg-slate-50`, voir
 * `coquille-app/espace-application.tsx`). Total et A faire passent au blanc
 * franc ; Resume et « Vos applications » passent d'un degrade brun a un
 * degrade neutre presque noir ; Urgent passe de l'orange terreux du poster a
 * l'orange vif de marque. `couleurParCode` (slices du donut, badges) passe de
 * trois tons poster proches (dore/orange/jaune, peu distinguables) a la
 * palette categorielle du hub (`--chart-1/2/3`, deja concue et verifiee pour
 * la distinction daltonisme dans `dataviz`) — plus lisible et plus proche des
 * badges colores varies (vert/orange/violet) de la reference.
 *
 * Dixieme passe : le canevas de la coquille redevient transparent (motif de
 * marque visible partout ou aucune carte opaque ne le couvre, voir `coquille-
 * app/espace-application.tsx`) puis, retour explicite « le marron est trop
 * fort, reduit l'opacite, ça doit etre leger » : le degrade presque-noir de
 * « Vos applications » (et de `Resume`) passe d'un fond plein a une opacite
 * reduite (`/50` a `/60` par arret dans le degrade) — le motif se devine a
 * travers la carte plutot que d'etre masque par un noir plein.
 *
 * Onzieme passe : l'utilisateur a fait construire par Claude Code Desktop une
 * version executable complete de la reference "Virtus" (`GdaHub/assets/dash/
 * parClaudeCodeDesktop`, package `virtus-dashboard`) — jusque-la vue seulement
 * en maquette. Elle confirme la direction deja prise ici (memes couleurs de
 * marque, memes cartes tres arrondies) mais reste un habillage a donnees
 * fictives (barre laterale et entete propres avec navigation/notifications
 * inventees, objectifs et pourcentages d'avancement sans equivalent reel au
 * niveau du hub) : sa barre laterale et son entete ne remplacent pas ceux de
 * la coquille, deja partages par les 5 applications (voir memoire
 * [[uniformisation-design-hub]]) et deja alignes sur la meme reference
 * (`coquille-app/espace-application.tsx`, `barre-laterale.tsx`). Premiere
 * tentative : n'en reprendre que l'anneau de progression et une rangee de
 * pilules de filtre, sur des cartes claires — retour explicite « c'est pas
 * top, reprends le code que Claude Code Desktop a fait, le tien est
 * horrible » avec une capture du rendu sombre reel du paquet.
 *
 * Douzieme passe : le paquet `virtus-dashboard` est en realite entierement
 * sombre (`bg-bg text-white` sur toute la page, `Card` = `bg-surface`), pas
 * le canevas clair a cartes blanches suppose jusqu'ici. Le contenu de cet
 * ecran (pas la barre laterale ni l'entete, deja communs aux 5 applications)
 * adopte donc ce meme canevas sombre plein cadre — via la classe `dark` deja
 * utilisee par la barre laterale (`barre-laterale.tsx`) et ses jetons deja
 * definis dans `globals.css` (`--background`, `--card`, `--secondary`,
 * `--border`, `--muted-foreground`, `--primary`), plutot qu'une palette brute
 * dupliquee : c'est la meme mecanique que `dark:` deja en place pour la barre
 * laterale, appliquee ici au contenu. Le canevas devient opaque (`bg-
 * background`, en debord de la marge de `<main>` pour aller bord a bord comme
 * la reference) et couvre donc le motif de marque de la coquille sur cette
 * page precise — un choix delibere pour cet ecran, pas un retrait du motif
 * ailleurs. Toutes les cartes passent de blanc/dore a `bg-card` sombre avec
 * `border-border`, les badges d'etat a des teintes translucides lisibles sur
 * fond sombre, et les pilules de filtre au meme traitement que les onglets de
 * `PerformanceSection` (`bg-secondary`, actif `bg-primary text-primary-
 * foreground`). Le contenu reste inchange : mêmes elements reels, aucun
 * chiffre invente.
 */

import Link from "next/link";

import { Coquille } from "@/composants/Coquille";
import { AFaire } from "@/composants/dashboard-hub/a-faire";
import { Resume } from "@/composants/dashboard-hub/resume";
import { Total } from "@/composants/dashboard-hub/total";
import { Urgent } from "@/composants/dashboard-hub/urgent";
import { useElementsAFaire } from "@/composants/dashboard-hub/utiliser-a-faire";
import { iconePourApplication } from "@/lib/icones-applications";
import { grouper } from "@/lib/groupes";
import { useSession } from "@/lib/session";

/** Palette categorielle du hub (`--chart-1/2/3` de `globals.css`), pas les
 * tons poster (trop proches entre eux pour un donut lisible) ni les couleurs
 * de marque propres a chaque application. */
const COULEUR_PAR_CODE: Record<"rh" | "finance" | "planning", string> = {
  rh: "#2a78d6",
  finance: "#1baf7a",
  planning: "#eb6834",
};
const COULEUR_PAR_DEFAUT = "#4a3aa7";

export default function PageTableauDeBord() {
  return (
    <Coquille>
      <Contenu />
    </Coquille>
  );
}

function Contenu() {
  const { profil } = useSession();
  // Le hook doit s'executer a chaque rendu, y compris avant que le profil
  // n'arrive : une liste vide le laisse inerte sans violer les regles des
  // hooks (pas d'appel conditionnel selon `profil`).
  const applications = profil?.applications ?? [];
  const elements = useElementsAFaire(applications);

  if (!profil) return null;

  const { utilisateur } = profil;
  const sections = grouper(applications);
  const premierPrenom = (utilisateur.nom_complet || utilisateur.identifiant).split(/\s+/)[0];
  const aujourdhui = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  // Couleurs des trois sources de « A faire », palette categorielle plutot
  // que la couleur de marque propre a chaque application (identity). Les
  // autres applications (Chantiers, Campagnes, Jus d'Orange...), qui
  // n'alimentent jamais « A faire », retombent sur un violet neutre par
  // defaut plutot que de reintroduire leurs couleurs de marque ici.
  const couleurParCode: Record<string, string> = Object.fromEntries(
    applications.map((application) => [
      application.code,
      COULEUR_PAR_CODE[application.code as keyof typeof COULEUR_PAR_CODE] || COULEUR_PAR_DEFAUT,
    ]),
  );

  return (
    <div className="dark relative -m-4 min-h-[calc(100svh-4rem)] bg-background text-foreground md:-m-6">
      <div className="p-4 md:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Bonjour {premierPrenom}</h1>
        <p className="mt-1 text-sm capitalize text-muted-foreground">{aujourdhui}</p>

        {applications.length === 0 ? (
          <div className="relative mt-6 rounded-3xl border border-dashed border-border bg-card/70 p-8 text-center text-sm text-muted-foreground">
            Votre compte est bien actif, mais aucune habilitation ne lui a encore
            ete accordee. Un administrateur de GDA Hub doit vous ouvrir les
            applications dont vous avez besoin.
          </div>
        ) : (
          <div className="relative mt-6 space-y-5">
            {/* Rangee 1 : pile [Total + Urgent] a gauche, Resume etire a droite. */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-5 lg:items-stretch">
              <div className="flex flex-col gap-5 lg:col-span-2">
                <Total elements={elements} />
                <Urgent elements={elements} />
              </div>
              <div className="lg:col-span-3">
                <Resume elements={elements} couleurParCode={couleurParCode} />
              </div>
            </div>

            {/* Rangee 2 : A faire (large) a gauche, Vos applications plus etroit a droite. */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-5 lg:items-stretch">
              <div className="lg:col-span-3">
                <AFaire elements={elements} couleurParCode={couleurParCode} />
              </div>

              <div className="h-full rounded-3xl border border-border bg-card p-5 lg:col-span-2">
                <h2 className="text-base font-semibold">Vos applications</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {sections.flatMap((section) =>
                    section.applications.map((application) => {
                      const Icone = iconePourApplication(application.code);
                      const couleur = couleurParCode[application.code];
                      return (
                        <Link
                          key={application.code}
                          href={application.chemin || "/tableau-de-bord"}
                          className="group flex items-center gap-2 rounded-full border border-border bg-secondary/60 py-1.5 pl-1.5 pr-3.5 transition hover:-translate-y-px hover:bg-secondary"
                        >
                          <span
                            className="flex size-7 shrink-0 items-center justify-center rounded-full"
                            style={{ background: `color-mix(in srgb, ${couleur} 25%, transparent)` }}
                          >
                            <Icone size={14} strokeWidth={2} style={{ color: couleur }} />
                          </span>
                          <span className="text-sm font-medium text-foreground/85">{application.nom}</span>
                        </Link>
                      );
                    }),
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
