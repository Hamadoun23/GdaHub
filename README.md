# GDA Hub — centralise tous les services et informations

Un seul compte par personne, une seule adresse, et derrière tout ce que fait le
groupe. L'ERP se lit en deux blocs :

- **Board** — le siège : l'**organigramme**, les **ressources humaines**, la
  **finance**, la **direction** ;
- **les quatre applications métier** — Campagnes (BDM/UBA), Jus d'Orange,
  Chantiers, Planning.

Board vient en premier parce qu'il détient ce dont toutes les autres ont
besoin : qui travaille ici, dans quel département, sous quelle autorité.

Le directeur général se connecte une fois et retrouve ce qui le concerne ; un
commercial de terrain se connecte de la même façon et ne voit qu'une
application.

Stack : **Django + DRF**, **React / Next.js**, **PostgreSQL**, le tout dans
Docker. Rien d'autre.

---

## 1. Démarrer

```powershell
copy .env.example .env
docker compose up -d
```

Puis <http://localhost:8080>.

| Compte | Identifiant | Mot de passe |
| ------ | ----------- | ------------ |
| Super administrateur | `hcisse@gdamali.net` | **`admin`** |
| Comptes de l'effectif de démonstration | `d.general@exemple.net`, … | **`12345`** |

Les deux mots de passe sont différents, et c'est facile à confondre : celui du
super administrateur est `admin`, `12345` étant celui attribué aux comptes
importés du fichier d'effectif.

Changez-les à la première connexion — le nom en haut à droite mène à
« Mon compte », qui porte le formulaire. Le changement ferme toutes les
sessions ouvertes ailleurs.

```powershell
docker compose logs -f identity   # journaux d'un service
docker compose down               # arrêt, les données restent
docker compose down -v            # arrêt ET suppression des bases
```

Le code est monté en volume : une modification est prise en compte sans
reconstruire l'image, côté Django comme côté Next.

---

## 2. Ce qui tourne

| Service | Bloc | Rôle | Base | Port |
| ------- | ---- | ---- | ---- | ---- |
| `gateway` | — | nginx, l'unique porte d'entrée | — | **8080** |
| `web` | — | shell React/Next, toutes les interfaces | — | 3100 |
| `identity` | — | comptes, habilitations, signature des jetons | `identity` | 8101 |
| `organisation` | Board | organigramme : agents, départements, rattachements | `organisation` | 8106 |
| `rh` | Board | congés, permissions, retards, présences | `rh` | 8107 |
| `finance` | Board | engagements, dépenses, caisse | `finance` | 8108 |
| `direction` | Board | règles de validation, décisions, consolidé | `direction` | 8109 |
| `bdm` | Métier | campagnes de cartes bancaires | `bdm` | 8102 |
| `orange` | Métier | récolte, fabrication, distribution | `orange` | 8103 |
| `daily` | Métier | suivi de chantier | `daily` | 8104 |
| `planning` | Métier | publications, tournages | `planning` | 8105 |

**Neuf bases Postgres distinctes, une par service.** Aucun service ne peut lire
les tables d'un autre, même par erreur : c'est cette contrainte qui rend le
découpage réel plutôt que déclaratif. Tous les ports sont publiés sur
`127.0.0.1` seulement, et décalés pour cohabiter avec la pile FinanceRH.

En usage normal, une seule adresse suffit : `http://localhost:8080`. Les ports
par service ne servent qu'au débogage.

---

## 3. Le compte unique, concrètement

```
navigateur ──► gateway ──► identity        (identifiant + mot de passe)
                             │
                             └─► jeton d'accès signé RS256, 15 minutes
                                   │
navigateur ──► gateway ──► rh ────┘        (vérifie la signature via JWKS)
```

1. `identity` est le **seul** service qui connaît les mots de passe et le seul
   qui signe. Sa clé privée ne sort jamais de son conteneur.
2. Les autres services ne possèdent **aucune table d'utilisateurs**. Ils
   vérifient la signature du jeton avec la clé publique publiée sur
   `/.well-known/jwks.json`, et lisent dedans les rôles de l'utilisateur.
3. Un service ne voit que **ses** rôles. Le même jeton dit « direction » à
   Campagnes et « chef de chantier » à Chantiers ; chaque service ne lit que sa
   propre entrée.

Conséquence à connaître : un droit retiré ne prend effet qu'à l'expiration du
jeton d'accès, **quinze minutes au plus**. C'est le prix de l'absence d'appel
réseau à chaque requête. Pour couper immédiatement, il faut désactiver le
compte — les jetons de rafraîchissement, eux, sont révoqués sur-le-champ.

### Un compte, des habilitations

Les rôles ne sont pas portés par le compte mais par l'**habilitation**, une
ligne par couple compte/application :

| Utilisateur | Application | Rôles |
| ----------- | ----------- | ----- |
| Y. H. Diallo | `rh`       | `direction` |
| Y. H. Diallo | `bdm`      | `direction` |
| Y. H. Diallo | `daily`    | `admin` |

Mettre les rôles sur l'utilisateur obligerait à inventer des codes globaux
(`admin_bdm`, `admin_daily`…) que chaque nouvelle application allongerait.

---

## 4. Pourquoi Board est découpé en quatre

L'application en production, FinanceRH, réunit les ressources humaines et la
finance. Ce qui les tenait ensemble n'était pas le métier mais **le circuit de
validation**, partagé par les deux. Une fois ce circuit sorti — le code dans le
socle, les règles chez `direction` — plus rien ne justifiait qu'une demande de
congé et un bon d'engagement habitent la même base.

`organisation` est le morceau décisif. C'est **le propriétaire unique de la
notion d'employé**, et c'est l'arbitrage le plus lourd de tout l'ERP : quatre
applications d'origine tenaient chacune sa liste d'agents, avec des champs et
des cycles de vie différents. Une seule doit rester. Les autres services
stockent un `agent_id` nu et le nom qu'ils affichent, figé à l'enregistrement.

**Une réserve sur `direction`** : ce service ne possède presque rien — les
règles de circuit et le registre des décisions. Un service sans données propres
est un candidat naturel à la fusion. Si ces règles se révèlent stables au point
de ne jamais changer sans redéploiement, `direction` n'a pas besoin d'exister
séparément : ses règles rejoindraient le socle et son tableau de bord serait un
écran du shell. À trancher après la reprise, sur des données réelles — pas
maintenant.

---

## 5. Structure du dépôt

```
GdaHub/
├─ docker-compose.yml       la pile complète
├─ gateway/nginx.conf       l'unique porte d'entrée
├─ libs/gdahub_common/      le socle partagé par tous les services Django
├─ services/
│  ├─ identity/             comptes, habilitations, jetons
│  ├─ organisation/         Board — l'organigramme
│  ├─ rh/                   Board — ressources humaines
│  ├─ finance/              Board — finance
│  ├─ direction/            Board — circuits et décisions
│  ├─ bdm/                  domaine « campagnes »
│  ├─ orange/               domaine « jusorange »
│  ├─ daily/                domaine « chantiers »
│  └─ planning/             domaine « planning »
└─ web/                     shell React/Next
```

`libs/gdahub_common` contient ce qui doit être **identique partout** :
authentification, permissions, pagination, format d'erreur, réglages Django. Un
service qui redéfinit l'un des quatre casse la promesse faite au front.

---

## 6. Les règles d'architecture

Elles reprennent le cadre posé dans `prompts_migration_erp.md` et ne se
négocient pas au cas par cas — c'est ce qui rend l'extraction d'un service
possible plus tard.

1. **Un domaine = un service = ses tables.** Personne d'autre n'y écrit, ni n'y
   lit.
2. **Aucune clé étrangère entre deux domaines.** On stocke `<domaine>_id` plus
   un instantané des champs affichés. À l'intérieur d'un domaine, les FK sont
   normales.
3. **Aucun import d'un modèle d'un autre domaine.** Tout passe par
   `<module>/api.py`, qui deviendra un client HTTP le jour de l'extraction.
4. Les vues ne portent pas de règle métier ; elle vit dans `services.py`.
5. Le format d'erreur, la pagination et les conventions d'URL viennent du socle,
   jamais du service.

La règle 2 surprend au début : elle interdit `select_related` vers un autre
domaine et oblige à recopier un nom. C'est exactement ce qui évite qu'un ERP
monté par agrégation finisse avec trois référentiels qui divergent en silence.

---

## 7. Où en est le travail

| Brique | État |
| ------ | ---- |
| Socle partagé (auth, permissions, pagination, erreurs) | fait |
| `identity` : comptes, habilitations, jetons, journal | fait |
| Passerelle, shell, connexion, tableau de bord | fait |
| Squelettes des huit services métier | fait |
| **`organisation` : agents, départements, organigramme** | **fait** — 26 tests |
| `rh`, `finance`, `direction`, et les quatre métiers | **à porter** |

Les services non portés répondent sur `/api/<code>/apercu` : la page de
l'application dans le shell appelle ce point d'entrée et affiche les rôles que
le service a lus dans le jeton. Tant qu'il répond, la chaîne complète — compte
unique, signature, vérification, cloisonnement — fonctionne.

Les tests d'un service se lancent depuis son conteneur :

```powershell
docker compose exec organisation python manage.py test
```

### L'effectif : un fichier, deux services

L'organigramme réel — noms, adresses, rattachements — est une **donnée, pas du
code**. Il vit dans `infra/effectif/personnel.json`, ignoré par git ; le dépôt
ne publie que `personnel.exemple.json`, un jeu anonyme de même forme. Sans
fichier réel, l'ERP s'amorce sur l'exemple : il démarre et se parcourt sans
jamais exposer qui que ce soit.

Deux commandes lisent ce même fichier, chacune dans son service :

```powershell
docker compose exec identity     python manage.py importer_comptes
docker compose exec organisation python manage.py importer_effectif
```

`identity` y crée les **comptes** et traduit le rôle unique de l'application
d'origine (SALARIE, RH, FINANCE, DIRECTION) en **habilitations par
application** — c'est le vrai travail de la reprise, et il est écrit à un seul
endroit. `organisation` y crée les **fiches d'agent**.

Les deux services ne s'appellent jamais. Ils dérivent le même identifiant de
connexion via `gdahub_common.effectif`, et **la fiche rejoint son compte à la
première connexion de l'intéressé** : son jeton porte à la fois son identifiant
et le numéro de son compte, les deux bouts du lien. Cela évite d'inventer une
authentification de service pour un simple appariement.

### Ordre de reprise

Identity d'abord pour tout le monde, c'est fait. Ensuite **un service par
vague, jamais deux en parallèle** :

| Vague | Service | Source | Pourquoi celui-là |
| ----- | ------- | ------ | ----------------- |
| 1 | `organisation` | `FinanceRH/backend/accounts` | Il détient l'annuaire réel — agents, départements, responsables. C'est de lui que doivent sortir les comptes d'`identity`, pas d'une saisie manuelle |
| 2 | `rh` | `FinanceRH/backend/rh` | Le domaine le plus mûr, et le seul déjà utilisé quotidiennement |
| 3 | `finance` | `FinanceRH/backend/finance` | Même origine, même circuit ; se porte dans la foulée |
| 4 | `direction` | `FinanceRH/backend/core` | Les règles de circuit, une fois qu'on sait ce que RH et finance en attendent |
| 5 | `daily` | `ERP-GDA-Aba-4-module-/backend/apps/chantiers` | Déjà en Django/DRF, modèles et sérialiseurs repris tels quels |
| 6 | `planning` | `ERP-GDA-Aba-4-module-/backend/apps/planning` | Même situation, domaine plus petit |
| 7 | `orange` | `DocsERP/Orange-full2/back` | Django + DRF, mais huit modules à découper |
| 8 | `bdm` | `DocsERP/BDM/backend` | Le plus lourd : Inertia à remplacer par du DRF, schéma hérité de Laravel, migration MySQL → Postgres |

**FinanceRH reste en production sur rh.gdamali.net et n'est pas modifiée pour
l'ERP.** On lit son schéma et ses données, on ne touche pas à l'application :
des congés posés et des demandes en cours de validation y vivent. GDA Hub monte
en parallèle et ne prend le relais que lorsqu'il a fait ses preuves.

---

## 8. Avant toute mise en service

- **Le mot de passe du super administrateur** vaut `admin` par défaut, et les
  comptes importés de l'effectif reçoivent `12345`. Ni l'un ni l'autre n'a de
  raison de survivre à la première connexion.
- **`runserver` n'est pas un serveur de production.** Les `Dockerfile` portent
  déjà une cible `production` sous gunicorn ; il reste à écrire le
  `docker-compose.prod.yml` qui l'utilise, sur le modèle de FinanceRH.
- **Le fichier d'effectif réel** (`infra/effectif/personnel.json`) n'est pas
  versionné. Sans lui, l'ERP s'amorce sur le jeu anonyme — visible au premier
  démarrage, qui l'annonce explicitement.
