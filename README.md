# GDA Hub — centralise tous les services et informations

Un seul compte par personne, une seule adresse, et derrière les applications du
groupe : **RH & Finance**, **Campagnes** (BDM/UBA), **Jus d'Orange**,
**Chantiers** et **Planning**. Le directeur général se connecte une fois et
retrouve les cinq ; un commercial de terrain se connecte de la même façon et
n'en voit qu'une.

Stack : **Django + DRF**, **React / Next.js**, **PostgreSQL**, le tout dans
Docker. Rien d'autre.

---

## 1. Démarrer

```powershell
copy .env.example .env
docker compose up -d
```

Puis <http://localhost:8080>, avec le compte `admin` / `admin` créé au premier
démarrage — à changer immédiatement.

```powershell
docker compose logs -f identity   # journaux d'un service
docker compose down               # arrêt, les données restent
docker compose down -v            # arrêt ET suppression des bases
```

Le code est monté en volume : une modification est prise en compte sans
reconstruire l'image, côté Django comme côté Next.

---

## 2. Ce qui tourne

| Service      | Rôle                                     | Base       | Port local |
| ------------ | ---------------------------------------- | ---------- | ---------- |
| `gateway`    | nginx, l'unique porte d'entrée           | —          | **8080**   |
| `web`        | shell React/Next, toutes les interfaces  | —          | 3100       |
| `identity`   | comptes, habilitations, signature des jetons | `identity` | 8101   |
| `financerh`  | congés, permissions, retards, dépenses   | `financerh`| 8106       |
| `bdm`        | campagnes de cartes bancaires            | `bdm`      | 8102       |
| `orange`     | récolte, fabrication, distribution       | `orange`   | 8103       |
| `daily`      | suivi de chantier                        | `daily`    | 8104       |
| `planning`   | publications, tournages                  | `planning` | 8105       |

**Six bases Postgres distinctes, une par service.** Aucun service ne peut lire
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
navigateur ──► gateway ──► daily ─┘        (vérifie la signature via JWKS)
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
| Y. H. Diallo | `bdm`      | `direction` |
| Y. H. Diallo | `daily`    | `admin` |
| Y. H. Diallo | `planning` | `team` |

Mettre les rôles sur l'utilisateur obligerait à inventer des codes globaux
(`admin_bdm`, `admin_daily`…) que chaque nouvelle application allongerait.

---

## 4. Structure du dépôt

```
GdaHub/
├─ docker-compose.yml       la pile complète
├─ gateway/nginx.conf       l'unique porte d'entrée
├─ libs/gdahub_common/      le socle partagé par tous les services Django
├─ services/
│  ├─ identity/             comptes, habilitations, jetons
│  ├─ financerh/            domaine « rhfinance »
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

## 5. Les règles d'architecture

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

## 6. Où en est le travail

| Brique | État |
| ------ | ---- |
| Socle partagé (auth, permissions, pagination, erreurs) | fait |
| `identity` : comptes, habilitations, jetons, journal | fait |
| Passerelle, shell, connexion, tableau de bord | fait |
| Squelettes des cinq services métier | fait |
| Domaines métier (modèles, vues, écrans) | **à porter** |

Chaque service métier répond aujourd'hui sur `/api/<code>/apercu` : la page de
l'application dans le shell appelle ce point d'entrée et affiche les rôles que
le service a lus dans le jeton. Tant qu'il répond, la chaîne complète — compte
unique, signature, vérification, cloisonnement — fonctionne.

### Ordre de reprise proposé

Identity d'abord pour tout le monde, c'est fait. Ensuite **une application par
vague, jamais deux en parallèle** :

| Vague | Service | Source | Pourquoi celle-là |
| ----- | ------- | ------ | ----------------- |
| 1 | `financerh` | `FinanceRH` (en production) | Elle détient déjà l'annuaire réel : agents, départements, responsables. C'est d'elle que doivent sortir les comptes d'`identity`, pas d'une saisie manuelle |
| 2 | `daily` | `ERP-GDA-Aba-4-module-/backend/apps/chantiers` | Déjà en Django/DRF, modèles et sérialiseurs repris tels quels |
| 3 | `planning` | `ERP-GDA-Aba-4-module-/backend/apps/planning` | Même situation, domaine plus petit |
| 4 | `orange` | `DocsERP/Orange-full2/back` | Django + DRF, mais huit modules à découper |
| 5 | `bdm` | `DocsERP/BDM/backend` | Le plus lourd : Inertia à remplacer par du DRF, schéma hérité de Laravel, migration MySQL → Postgres |

Une réserve sur la vague 1 : FinanceRH **tourne en production** sur
rh.gdamali.net, avec des congés posés et des demandes en cours de validation.
On ne la bascule pas, on la double — l'identité passe à `identity`, le reste
suit quand le hub a fait ses preuves. Reprendre son annuaire d'abord n'oblige
en rien à éteindre l'application existante.

Avant la vague 2, un arbitrage reste à rendre : les entités partagées
(**employés, sites/agences, clients, périodes**) doivent avoir **un propriétaire
unique**. C'est le piège n°1 d'un ERP monté par agrégation, et cela se règle
avant le code. FinanceRH étant la seule à tenir un organigramme réel, elle est
la candidate évidente pour posséder « employé » — à confirmer.
