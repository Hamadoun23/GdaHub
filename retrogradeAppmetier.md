# Retrograde des apps metier vers leur identite visuelle propre

## Contexte et decision

Entre le 02/09/2026 et le 08/09/2026, une "uniformisation" a force toutes les
apps du hub (Jus d'orange, FinanceRH/RH, Chantiers, Planning) a partager un
seul systeme de design (celui de Jus d'orange, puis un habillage sombre repris
d'une maquette "Virtus"). Cette decision s'est averee etre une erreur : **ces
applications n'ont ni le meme but ni le meme workflow**, et forcer un seul
langage visuel dessus n'avait pas de sens metier.

**Decision retenue (11/09/2026)** : chaque app metier retrouve son identite
visuelle propre, celle qu'elle avait avant l'uniformisation. Le hub, lui,
garde le droit a un "super dashboard" soigne — mais **ce traitement visuel
special reste limite a la coquille du hub elle-meme** (son tableau de bord
d'accueil et son ecran de connexion), il ne doit plus jamais se propager aux
applications metier qu'il fait vivre derriere lui.

**Principe de navigation qui en decoule** : une fois connecte sur le hub, les
boutons de la sidebar du hub ne font que **rediriger** vers chaque app
metier — chaque app metier s'affiche alors avec son PROPRE design, distinct de
celui du hub et distinct des autres apps metier. Le hub est une porte
d'entree, pas un habillage qui s'etend a tout ce qu'il contient.

## Ce qui a deja ete fait (commit `db650dc`, pousse sur `master`)

Quatre apps metier ont retrouve leur identite propre :

- **Jus d'orange** (`frontend/src/jus/`) — sidebar + entete propres
  (`composants/app/app-sidebar.tsx`, `app-header.tsx`) restaurees telles
  quelles depuis l'historique git (commit `85850cd`, l'etat juste avant
  l'uniformisation). Fond clair, accent orange JusOrange (`Citrus`, marque
  "JusOrange / Pilotage production").
- **FinanceRH** (`frontend/src/rh/`) — sidebar + barre superieure + barre
  d'onglets basse mobile propres (`composants/navigation.tsx`) restaurees de
  la meme facon depuis `85850cd`. Logo GD&A, jetons de couleur `--marque-*`
  propres a FinanceRH.
- **Chantiers** (`frontend/src/chantiers/`) — **reconstruit** (aucune version
  anterieure n'avait ete commitee separement en git ; l'app avait ete creee
  ET uniformisee dans la meme fenetre de travail, jamais commitee entre les
  deux). Identite reprise du Laravel source de verite
  `C:\Users\cisse\Downloads\FinanceRH\DocsERP\dailygda`
  (`public/css/gda.css`) : entete sombre fixe avec banniere de chantier en
  fond (`/img/chantiers/banniere.png`), palette creme `#f4f1eb`, terracotta
  `#c8521a`, titre marron `#381419`, vert `#1a7a42`, bleu `#1a5c8a`, rouge
  `#c01a1a`. Sidebar claire avec commutateur de projet actif. Fichiers :
  `composants/navigation.tsx` (nouveau), `composants/espace-chantiers.tsx`
  (reecrit).
- **Planning** (`frontend/src/planning/`) — **reconstruit** de la meme facon
  que Chantiers (memes contraintes : jamais commite separement). Identite
  reprise de `DocsERP/Planning-main` (Laravel) : degrade orange en entete
  (`#ff8a5c` -> `#ff6a3a` -> `#e8481b`) et barre horizontale a 5 onglets
  (Tableau de bord / Clients / Idees de contenu / Tournages / Publications).
  Fichiers : `composants/navigation.tsx` (nouveau),
  `composants/espace-planning.tsx` (reecrit).

Retires au passage : les wrappers `className="dark ..."` herites de la
maquette Virtus sur les pages de CONTENU de ces quatre apps (pas seulement
leur chrome), et les composants `coquille-app` devenus orphelins
(`espace-jus.tsx`, `espace-rh.tsx`).

**Perimetre volontairement NON touche par ce commit** : le rattachement
FinanceRH/Jus/Campagnes sous le hub (plomberie fonctionnelle), le renommage
backend BDM -> Campagnes, le module Planning cote backend, et — c'est le
point important pour la suite — **le tableau de bord du hub lui-meme
(`frontend/src/app/tableau-de-bord/`, `frontend/src/composants/Coquille.tsx`)
et son ecran de connexion (`frontend/src/app/connexion/`)**, qui portent
encore l'habillage sombre issu de la maquette "Virtus"
(`assets/dash/maquette HUB GDA.png`).

## Ce qu'il reste a faire

1. **Le hub garde son "super dashboard"** : ne pas toucher / ne pas
   retrograder `tableau-de-bord/page.tsx`, `Coquille.tsx`,
   `app/connexion/page.tsx` — c'est le seul endroit du depot ou l'habillage
   issu de la maquette Virtus est legitime. Si une session future doit encore
   l'ameliorer, le perimetre reste explicitement la coquille du hub
   (accueil + connexion), jamais les apps metier.
2. **Verifier/renforcer la navigation hub -> apps metier** : les entrees de
   la sidebar du hub (definies via `grouper(profil.applications)`, cf.
   `composants/coquille-app/` encore utilise par le hub lui-meme) doivent se
   comporter comme de simples liens de redirection vers `/jus`, `/rh`,
   `/chantiers`, `/planning`, `/campagnes` — chacune de ces routes affichant
   desormais son propre habillage (voir section precedente), distinct de
   celui du hub. S'assurer qu'aucun etat visuel du hub (motif de fond,
   variables `--sidebar-*` sombres, etc.) ne fuit sur la premiere image
   affichee lors de la transition.
3. **Integration avec l'autre version du depot** : l'utilisateur a une autre
   version de ce depot ailleurs, avec potentiellement d'autres changements
   (peut-etre sur le hub lui-meme, peut-etre sur d'autres apps). Comparer
   avant de fusionner : ce commit (`db650dc`) ne touche QUE les quatre
   dossiers d'apps metier listes plus haut plus 2 suppressions de fichiers
   orphelins — tout changement fait ailleurs sur `tableau-de-bord/`,
   `Coquille.tsx`, `connexion/`, le backend, ou l'infra Docker est independant
   et peut se fusionner sans conflit attendu.
4. **RH non verifie visuellement** (contrairement a Jus/Chantiers/Planning,
   captures via Playwright, aucune erreur console) : le compte de test local
   `hcisse@gdamali.net / admin` recoit un `401 "Informations d'authentification
   non fournies"` sur les endpoints `/api/rh/...` et `/api/finance/...` dans
   cet environnement Docker local frais — un probleme de liaison de compte
   pre-existant (`identifiants_locaux` non renseigne pour ce compte dans
   cette base neuve), documente dans le message de fin de
   `infra/demarrer.sh` lui-meme, sans rapport avec ce changement de design.
   Le code a ete verifie par restauration mecanique depuis git (`85850cd`,
   identique a Jus) et par `tsc --noEmit` propre — mais une verification
   visuelle reelle reste a faire des qu'un compte correctement lie sera
   disponible.

## Reperes utiles

- Palette Chantiers et lien vers le CSS source : voir
  `frontend/src/chantiers/composants/navigation.tsx` (commentaire d'en-tete)
  et `DocsERP/dailygda/public/css/gda.css`.
- Palette/structure Planning : voir
  `frontend/src/planning/composants/navigation.tsx` et
  `DocsERP/Planning-main` (Laravel, `resources/views/layouts/app.blade.php`).
- Etat "avant uniformisation" complet (utile si une autre app doit etre
  retrogradee un jour) : commit git `85850cd` ("Campagnes chargeait ses
  morceaux a la mauvaise adresse", 27/08/2026) — dernier commit avant que
  tout le travail d'uniformisation (jamais commite par etapes) soit ecrase
  dans le commit unique `0245da1` ("Premiere publication du depot GDA Hub",
  08/09/2026).
