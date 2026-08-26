# Plan de developpement de GDA Hub

Ce document dit **quoi construire, dans quel ordre, et pourquoi cet ordre-la**.
L'etat d'avancement vit dans la derniere section.

---

## 1. Ce que GDA Hub est - et ce qu'il n'est pas

GDA Hub **ne developpe aucune application metier**. Trois d'entre elles
tournent deja en production, elles fonctionnent, et les reecrire serait
detruire du travail qui sert tous les jours.

| Application | En production sur | Front | Back | Base |
| ----------- | ----------------- | ----- | ---- | ---- |
| FinanceRH | `rh.gdamali.net` | Next.js | Django | PostgreSQL 17 |
| Jus d'orange | `jus.gdamali.net` | Next.js | Django (gunicorn) | - |
| BDM | `bdm.gdamali.net` | React/Vite via Inertia | Django | MySQL 8 |
| Daily | *non deployee* | - | Django (stagiaire) | - |
| Planning | *non deployee* | - | Django (stagiaire) | - |

GDA Hub **rassemble** ces applications. Aujourd'hui elles tournent
independamment : trois domaines, trois sessions, trois comptes pour la meme
personne. Le hub en fait un seul systeme.

Ce qu'il apporte, et rien d'autre :

1. **Un domaine** - `hub.gdamali.net`, une passerelle, tout au meme niveau.
2. **Un compte** - on se connecte une fois, on circule partout.
3. **Une architecture en microservices** - chaque application garde sa base et
   son code, aucune ne depend du demarrage d'une autre.

### Ce qui a ete construit a tort

Une premiere version du hub a reecrit huit services metier avec des ecrans
neufs (rh, finance, orange, bdm, direction, daily, planning). C'etait une
erreur de lecture : le but n'etait pas de refaire, mais de rassembler. Ce code
est conserve le temps que les applications reelles soient branchees, puis
retire.

Ce qui en survit est precisement la machinerie de federation, et elle est
bonne : `identity` (compte unique, jetons RS256, JWKS), les habilitations par
application, l'annuaire, la passerelle.

---

## 2. L'architecture cible

```
hub.gdamali.net  -- passerelle nginx
|
+-- /               coquille GDA Hub : connexion, accueil, annuaire
+-- /rh/            FinanceRH    (front Next.js + API Django + PostgreSQL)
+-- /jus/           Jus d'orange (front Next.js + API Django)
+-- /bdm/           BDM          (Django + Inertia/React + MySQL)
+-- /chantiers/     Daily        (repris du stagiaire)
+-- /planning/      Planning     (repris du stagiaire)
```

**Une application = un service = une base.** Aucune cle etrangere ne traverse
une frontiere de service. Ce qu'une application a besoin de savoir d'une autre,
elle en garde une copie datee, jamais un lien vivant.

---

## 3. Le compte unique

C'est le seul point commun entre les cinq applications, et le seul endroit ou
le hub s'invite dans leur code.

### Le chainon qu'on n'avait pas vu : les identifiants ne se ressemblent pas

Le hub identifie une personne par son adresse professionnelle. Les
applications rassemblees, elles, ont ete peuplees a des epoques et par des
chemins differents :

| Application | Ce que portent ses comptes | Exemple |
| ----------- | -------------------------- | ------- |
| FinanceRH | l'adresse professionnelle | `hcisse@gdamali.net` |
| Jus d'orange | des comptes de role | `resprod@jusorange.local` |
| BDM | des adresses fabriquees a la reprise depuis Laravel | `juin2026.74082712@import.gda` |

Rien ne relie ces trois vues d'une meme personne. **Sans correspondance, le
compte unique ne fonctionnerait que pour FinanceRH**, et le hub ne
rassemblerait rien du tout.

D'ou `Habilitation.identifiant_local` : une ligne par compte et par
application dit sous quel nom cette personne y est connue. Le champ reste vide
quand l'adresse suffit. Le jeton transporte la table, et chaque application ne
lit que sa propre entree — prendre celle du voisin ouvrirait la session de
quelqu'un d'autre.

C'est du travail de donnees, pas de code : quelqu'un qui connait les gens doit
dire qui est qui. Le hub ne peut pas le deviner.

`identity` signe un jeton RS256. Chaque application le verifie par la cle
publique publiee sur `/.well-known/jwks.json`, puis **rattache le jeton a son
propre utilisateur** par l'adresse professionnelle. Rien d'autre ne change chez
elle : ses roles, ses permissions, ses ecrans restent les siens.

Les trois applications ne s'authentifient pas de la meme facon, et c'est le
travail a faire :

| Application | Aujourd'hui | A ajouter |
| ----------- | ----------- | --------- |
| FinanceRH | SimpleJWT, `accounts.Utilisateur` | une classe d'authentification qui accepte aussi le jeton du hub |
| Jus d'orange | jeton DRF + session, `auth.User` | la meme |
| BDM | session Django, hachages bcrypt herites de Laravel | la meme, plus une entree de session |

**Regle : le hub ne remplace jamais l'authentification d'une application, il
s'ajoute a cote.** Chacune doit continuer a fonctionner seule, sans le hub -
sinon une panne du hub arrete toute l'entreprise, et le retour arriere devient
impossible.

**Corollaire : aucun de ces changements ne touche la production.** Le
rattachement au hub est commande par une variable d'environnement absente en
production. `rh.gdamali.net` continue de servir a la racine avec son propre
login tant que la bascule n'est pas decidee.

---

## 4. Servir une application sous un chemin

C'est la difficulte technique de la passerelle unique : une application ecrite
pour la racine ne se sert pas telle quelle sous `/rh/`.

| Front | Mecanisme | Effet sur la production |
| ----- | --------- | ----------------------- |
| Next.js (FinanceRH, Jus) | `basePath` pilote par une variable | aucun : variable absente = racine |
| Django + Inertia (BDM) | `FORCE_SCRIPT_NAME` + `STATIC_URL` | aucun : meme principe |

Aucun chemin absolu ne doit etre ecrit en dur dans le code. La ou il y en a,
c'est un defaut a corriger, pas une exception a contourner.

---

## 5. Ordre de travail

L'ordre suit le risque : ce qui peut invalider le reste passe en premier.

1. **FinanceRH sous `/rh/`** - l'application de reference, celle que je connais
   le mieux. Elle prouve la passerelle, le `basePath` et le compte unique.
2. **Jus d'orange sous `/jus/`** - meme forme (Next + Django), confirme que la
   methode se transporte.
3. **BDM sous `/bdm/`** - forme differente (Django + Inertia, MySQL), eprouve
   le cas limite.
4. **Retrait des modules reecrits** - une fois les trois branchees, ce qui fait
   double emploi est supprime.
5. **Daily et Planning** - reprise du travail du stagiaire, correction, puis
   integration au hub comme les autres.

---

## 6. Etat d'avancement

| Etape | Etat |
| ----- | ---- |
| Socle : identity, jetons RS256, JWKS, habilitations | fait |
| Passerelle nginx, un domaine | fait |
| Annuaire (organisation) | fait |
| FinanceRH sous `/rh/` | ecrit, non execute |
| Jus d'orange sous `/jus/` | ecrit, non execute |
| BDM sous `/bdm/` | ecrit, non execute |
| Correspondance des identifiants locaux | ecrite, non executee |
| Reprise des donnees de production | script ecrit, sauvegardes recuperees |
| Retrait des modules reecrits | a faire |
| Daily et Planning repris du stagiaire | a faire |
| Remplir la correspondance des identifiants | a faire — travail de donnees |

« Ecrit, non execute » veut dire ce qu'il dit : le code et la configuration
sont en place, les deux fichiers compose sont valides et les 77 tests de
FinanceRH passent, mais **rien n'a encore tourne sous la passerelle**. Docker
Desktop ne demarre plus sur la machine de developpement (WSL ne parvient plus
a creer de machine virtuelle). Aucune de ces lignes ne doit etre tenue pour
acquise avant d'avoir vu la chaine complete fonctionner.
