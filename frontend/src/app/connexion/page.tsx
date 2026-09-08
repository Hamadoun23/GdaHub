"use client";

/**
 * Une seule page de connexion pour tout le groupe.
 *
 * C'est le point de l'ERP le plus visible pour l'utilisateur : le directeur
 * general saisit un identifiant, une fois, et retrouve derriere les quatre
 * applications qu'il suit.
 *
 * Quatrieme version. Trois essais de fond ont ete rejetes tour a tour : deux
 * colonnes avec motif noir/orange separes, motif orange abstrait en plein
 * cadre, puis une photographie recadree (reprise d'une reference montree par
 * l'utilisateur, un site nomme « EOSAI ») — toutes jugees « horrible ».
 * Reponse finale, sans ambiguite : pas de photo du tout. Le fond est un
 * degrade de couleur — plusieurs taches floutees dans les tons de marque
 * (orange, ambre, un coin sombre pour la profondeur) sur un canevas
 * quasi-noir, une technique de « mesh gradient » courante sur les sites
 * premium actuels (Linear, Stripe...), sans dependre d'aucune image. La
 * carte de connexion reste en verre depoli par-dessus : c'est le degrade qui
 * se voit distordu a travers, pas une photo.
 *
 * Pas de bascule jour/nuit : retiree du hub entier a la demande explicite de
 * l'utilisateur, qui a choisi de rester en mode jour seul.
 *
 * Cinquieme passe : jugee « pas intuitive, trop naze » dans son ensemble.
 * Trois defauts reels identifies et corriges ensemble :
 * - Le bouton de validation etait blanc sur fond blanc translucide — il ne
 *   se distinguait pas comme l'action principale. Il est maintenant en
 *   orange de marque plein, la seule tache de couleur vive de la page.
 * - Le contraste du texte et des bordures de la carte etait trop faible sur
 *   le degrade sombre (`text-white/70`, `border-white/20`) — remonte partout.
 * - La page ne montrait que deux champs et rien d'autre : rien pour un mot
 *   de passe oublie, rien qui dise a qui s'adresser en cas de probleme. Il
 *   n'existe pas de reinitialisation en libre-service cote identity (seul
 *   `/auth/mot-de-passe` existe, et il faut deja etre connecte) : plutot
 *   qu'un lien mort, un texte dit explicitement de s'adresser a un
 *   administrateur.
 *
 * Sixieme passe : un ecran dedie au mobile, sur le modele d'une maquette
 * fournie par l'utilisateur (photo plein cadre, degrade sombre en bas,
 * texte et formulaire ancres au bas de l'ecran). Cette fois la photo n'est
 * pas rejetee : c'est un choix explicite, et pour le mobile seulement — le
 * degrade/verre ci-dessus reste inchange a partir de `md`. La photo est
 * celle du camion GDA (habillage de vehicule), fournie par l'utilisateur.
 * Les deux blocs partagent le meme etat et le meme `soumettre` ; seules les
 * classes `md:hidden` / `hidden md:flex` decident lequel s'affiche, pour
 * eviter deux implementations paralleles du meme formulaire.
 *
 * Septieme passe (mobile uniquement) : le premier ecran de la maquette
 * jugee « pas top ». L'utilisateur a demande le troisieme ecran, repris a la
 * lettre — titre d'abord, puis l'eyebrow (« GDA ») en dessous, pas l'inverse ;
 * et le bouton principal en blanc plein (comme son bouton « Reserve »), pas en
 * orange de marque. Le second bouton de cet ecran (« Buy », en contour) n'a
 * pas d'equivalent ici : il n'existe aucune deuxieme action a proposer a cote
 * de « Se connecter », donc pas de bouton fantome qui ne ferait rien au clic —
 * le mot de passe oublie reste un texte simple, pas un bouton, pour la meme
 * raison que plus haut (pas de lien mort).
 */

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Lock, User } from "lucide-react";

import { ErreurApi } from "@/lib/api";
import { useSession } from "@/lib/session";

export default function PageConnexion() {
  const { profil, chargement, connecter } = useSession();
  const routeur = useRouter();

  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  // Le formulaire est rendu cote serveur avant que React ne s'accroche au
  // navigateur. Entre les deux, un clic — ou Entree — declenche la
  // soumission HTML native du navigateur, sans passer par `soumettre` : ni
  // `preventDefault`, ni `connecter()`. Sans `action`/`method` explicites,
  // cette soumission par defaut part en GET vers l'URL courante, avec
  // l'identifiant et le mot de passe en clair dans la chaine de requete —
  // donc dans l'historique du navigateur et dans les journaux du serveur.
  // L'echec est ensuite silencieux : la page se recharge, le formulaire est
  // vide, rien n'explique ce qui s'est passe.
  //
  // Le bouton reste desactive tant que ce rendu n'a pas eu lieu : un
  // navigateur ne soumet pas implicitement un formulaire — ni au clic, ni a
  // la touche Entree — quand son bouton de validation est desactive.
  const [pret, setPret] = useState(false);
  useEffect(() => setPret(true), []);

  useEffect(() => {
    if (!chargement && profil) routeur.replace("/tableau-de-bord");
  }, [chargement, profil, routeur]);

  async function soumettre(evenement: React.FormEvent) {
    evenement.preventDefault();
    setErreur("");
    setEnvoi(true);
    try {
      await connecter(identifiant, motDePasse);
      routeur.replace("/tableau-de-bord");
    } catch (probleme) {
      setErreur(
        probleme instanceof ErreurApi
          ? probleme.message
          : "Le service d'authentification est injoignable.",
      );
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <>
      {/* --- Mobile : photo du camion GDA plein cadre, formulaire ancre
          en bas de l'ecran. Ne s'affiche qu'en dessous de `md` ; le
          degrade/verre historique reste la version desktop, inchangee
          plus bas. */}
      <div className="relative flex min-h-screen flex-col overflow-hidden md:hidden">
        <div className="absolute inset-0 -z-10">
          <Image
            src="/img/connexion-camion-gda.jpeg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </div>

        {/* Le camion et son logo restent visibles, non couverts, sur toute
            la partie haute. Le titre, la ligne de bienvenue et le
            formulaire vivent tous dans le meme panneau depoli en bas — un
            seul bloc qui mene droit au login, plutot qu'un titre isole en
            haut de l'ecran. */}
        <div className="mt-auto rounded-t-[2rem] bg-gradient-to-b from-black/60 via-[#3a1706]/75 to-black/85 px-7 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-6 backdrop-blur-md">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white">Hub GDA</h1>
          <p className="mt-3 text-sm leading-relaxed text-white/75">
            Ravi de vous accueillir sur le hub du groupe.
          </p>

          <form onSubmit={soumettre} method="post" action="/connexion" className="mt-6 flex flex-col gap-2.5">
            <label className="sr-only" htmlFor="identifiant-mobile">
              Identifiant
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ardoise-400" />
              <input
                id="identifiant-mobile"
                value={identifiant}
                onChange={(evenement) => setIdentifiant(evenement.target.value)}
                autoComplete="username"
                autoFocus
                required
                className="w-full rounded-xl border border-transparent bg-white/90 py-3 pl-11 pr-4 text-sm text-ardoise-900 outline-none transition placeholder:text-ardoise-400 focus:border-white focus:ring-2 focus:ring-white/40"
                placeholder="Identifiant"
              />
            </div>

            <label className="sr-only" htmlFor="mot-de-passe-mobile">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ardoise-400" />
              <input
                id="mot-de-passe-mobile"
                type={motDePasseVisible ? "text" : "password"}
                value={motDePasse}
                onChange={(evenement) => setMotDePasse(evenement.target.value)}
                autoComplete="current-password"
                required
                className="w-full rounded-xl border border-transparent bg-white/90 py-3 pl-11 pr-11 text-sm text-ardoise-900 outline-none transition focus:border-white focus:ring-2 focus:ring-white/40"
                placeholder="Mot de passe"
              />
              <button
                type="button"
                onClick={() => setMotDePasseVisible((visible) => !visible)}
                tabIndex={-1}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-ardoise-400 transition hover:text-ardoise-600"
              >
                {motDePasseVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                <span className="sr-only">
                  {motDePasseVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                </span>
              </button>
            </div>

            {erreur ? (
              <p role="alert" className="rounded-xl bg-red-950/70 px-3 py-2 text-sm text-red-100">
                {erreur}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={!pret || envoi}
              className="mt-2 w-full rounded-full bg-[#c9540c] px-4 py-3 text-sm font-medium text-white shadow-md shadow-[#7a3308]/40 transition hover:bg-[#ab470a] active:scale-[0.99] disabled:opacity-60"
            >
              {envoi ? "Connexion..." : "Se connecter"}
            </button>
          </form>

          <p className="mt-5 text-center text-[11px] leading-relaxed text-white/55">
            Mot de passe oublie ? Demandez a un administrateur de le
            reinitialiser depuis l&apos;espace Administration.
          </p>
        </div>
      </div>

      {/* --- Desktop (et tablette) : ecran scinde en deux, sur le modele
          d'une reference montree par l'utilisateur (une page d'accueil
          "Iceland" — moitie floutee/claire portant le debut du mot, moitie
          nette portant la suite, le tout formant un seul mot a cheval sur la
          coupure). Le login a ete demande a droite : c'est donc la moitie
          nette qui passe a gauche (elle porte « Hub », en blanc, comme
          « ice » sur la photo vive de la reference) et la moitie
          floutee/claire qui passe a droite, avec « GDA » en fonce et le
          formulaire — le mot se lit toujours « Hub GDA » de gauche a droite,
          seul le cote qui heberge le login a change. Les deux titres partent
          du meme padding-top plutot que d'un calcul de position : aligner
          deux blocs independants en pixels est fragile des qu'une chaine de
          caracteres change. */}
      <div className="relative hidden min-h-screen md:flex">
        <div className="relative flex-1 overflow-hidden">
          <Image
            src="/img/connexion-camion-gda.jpeg"
            alt=""
            fill
            priority
            sizes="56vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />
        </div>

        <div className="relative flex w-[44%] min-w-[420px] flex-col px-14 pb-16 pt-28">
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <Image
              src="/img/connexion-camion-gda.jpeg"
              alt=""
              fill
              priority
              sizes="50vw"
              className="scale-110 object-cover object-left blur-2xl brightness-[1.15] saturate-[0.35]"
            />
            <div className="absolute inset-0 bg-white/35" />
          </div>

          <h1 className="text-7xl font-bold leading-[0.95] tracking-tight text-[#c9540c]">
            Hub{" "}
            <span className="text-white [text-shadow:0_1px_3px_rgb(0_0_0_/_0.9),0_2px_16px_rgb(0_0_0_/_0.7)]">
              GDA
            </span>
          </h1>
          <p className="mt-5 max-w-xs text-sm text-ardoise-700">
            Ravi de vous accueillir sur le hub du groupe.
          </p>

          <form
            onSubmit={soumettre}
            // Filet de secours, pour le cas ou la soumission native se produirait
            // malgre tout : en POST, les identifiants voyagent dans le corps de
            // la requete plutot que dans l'URL. Il n'existe aucune route POST
            // /connexion cote serveur — la requete echouerait — mais un echec
            // reste preferable a un mot de passe grave dans l'historique.
            method="post"
            action="/connexion"
            className="mt-8 w-full max-w-xs text-left"
          >
            <label className="block text-sm font-medium text-ardoise-800" htmlFor="identifiant">
              Identifiant
            </label>
            <div className="relative mt-1.5">
              <User className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ardoise-400" />
              <input
                id="identifiant"
                value={identifiant}
                onChange={(evenement) => setIdentifiant(evenement.target.value)}
                autoComplete="username"
                autoFocus
                required
                className="w-full rounded-xl border border-transparent bg-white py-2.5 pl-10 pr-3 text-sm text-ardoise-900 shadow-sm outline-none transition placeholder:text-ardoise-400 focus:border-marque-500 focus:ring-2 focus:ring-marque-500/30"
                placeholder="e-mail, telephone ou nom"
              />
            </div>

            <label className="mt-5 block text-sm font-medium text-ardoise-800" htmlFor="mot-de-passe">
              Mot de passe
            </label>
            <div className="relative mt-1.5">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ardoise-400" />
              <input
                id="mot-de-passe"
                type={motDePasseVisible ? "text" : "password"}
                value={motDePasse}
                onChange={(evenement) => setMotDePasse(evenement.target.value)}
                autoComplete="current-password"
                required
                className="w-full rounded-xl border border-transparent bg-white py-2.5 pl-10 pr-10 text-sm text-ardoise-900 shadow-sm outline-none transition focus:border-marque-500 focus:ring-2 focus:ring-marque-500/30"
              />
              <button
                type="button"
                onClick={() => setMotDePasseVisible((visible) => !visible)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ardoise-400 transition hover:text-ardoise-600"
              >
                {motDePasseVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                <span className="sr-only">
                  {motDePasseVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                </span>
              </button>
            </div>

            {erreur ? (
              <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                {erreur}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={!pret || envoi}
              className="mt-6 w-full rounded-xl bg-[#c9540c] px-4 py-2.5 font-medium text-white shadow-lg shadow-[#7a3308]/30 transition hover:bg-[#ab470a] disabled:opacity-60"
            >
              {envoi ? "Connexion..." : "Se connecter"}
            </button>

            <p className="mt-4 text-center text-xs text-ardoise-700">
              Mot de passe oublie ? Demandez a un administrateur de le
              reinitialiser depuis l&apos;espace Administration.
            </p>
          </form>
        </div>
      </div>
    </>
  );
}
