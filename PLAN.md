# Plan de développement de GDA Hub

Ce document dit **quoi construire, dans quel ordre, et pourquoi cet ordre-là**.
Il se met à jour au fur et à mesure ; l'état d'avancement vit dans la
section 6.

---

## 1. Le principe qui commande tout le reste

Un ERP monté par agrégation échoue toujours de la même façon : trois
référentiels d'« employé » qui divergent en silence. L'ordre de construction
découle donc d'une seule règle — **on porte d'abord ce que les autres
consomment**, jamais l'inverse.

```
identity          qui a le droit d'entrer                    ✔ fait
    │
organisation      qui travaille ici, sous quelle autorité    ✔ fait
    │
direction         qui valide quoi, à partir de quel montant
    │
    ├── rh        congés, permissions, retards, présences
    └── finance   engagements, dépenses, caisse, missions
              puis les quatre applications métier
```

`direction` passe avant `rh` et `finance` parce que les deux lui demandent la
même chose : les règles de circuit. Les applications métier passent en dernier
parce qu'elles consomment l'annuaire sans rien lui apporter.

---

## 2. Le circuit de validation : où vit quoi

C'est la décision structurante de tout l'ERP, et elle mérite d'être écrite
noir sur blanc.

| Élément | Où il vit | Pourquoi |
| ------- | --------- | -------- |
| Le **moteur** — construire un circuit, enregistrer une décision, clore | `gdahub_common.validation` | Chaque service doit pouvoir valider sans appeler personne |
| Les **étapes** d'un dossier | dans la base du service qui porte le dossier | Une décision ne traverse jamais le réseau |
| Les **règles** — qui valide, à partir de quel montant, dans quel ordre | `direction` | C'est le métier de la direction, et cela se paramètre |
| Le **rattachement hiérarchique** | `organisation` | C'est l'organigramme, pas une règle de circuit |

Une seule dépendance subsiste, assumée : à la **création** d'un dossier, le
service demande à `organisation` l'instantané du demandeur et de son
responsable. Un appel, sur une action ponctuelle, avec le jeton de
l'utilisateur — donc sans authentification de service à inventer. Si
l'annuaire est injoignable, la création échoue franchement plutôt que de
produire un dossier qui ne remonte à personne.

Tout le reste se lit en local. En particulier, **les règles de circuit vivent
dans chaque service**, pas chez `direction` : ce sont des règles sur ses
propres documents, et les lire ailleurs ferait dépendre chaque soumission d'un
appel réseau. `direction` les administre à travers l'API de chaque service,
avec le jeton du directeur.

Une règle du moteur d'origine n'a pas pu être transposée telle quelle : elle
supprimait d'avance l'étape « service financier » quand le responsable du
demandeur portait lui-même ce rôle, ce qui suppose de connaître les rôles
d'autrui. Les habilitations vivant chez `identity`, on procède à l'envers, et
c'est plus juste : **une seule décision règle toutes les étapes que son auteur
pouvait trancher**, chacune restant consignée séparément.

---

## 3. Ce que chaque service possède

### Board — le siège

| Service | Possède | Repris de |
| ------- | ------- | --------- |
| `organisation` | agents, départements, rattachements, organigramme | `FinanceRH/accounts` |
| `direction` | règles de circuit, registre consolidé des décisions | `FinanceRH/core` |
| `rh` | types d'absence, soldes, demandes (congé, permission, retard), présences, évaluations, formations | `FinanceRH/rh` |
| `finance` | catégories, réquisitions, dépenses, caisse, missions, prestations, bons de commande | `FinanceRH/finance` |

### Les quatre applications métier

| Service | Possède | Repris de |
| ------- | ------- | --------- |
| `daily` | projets, phases, sous-phases, tâches, avancement journalier, photos, rapports | `ERP-GDA-Aba/apps/chantiers` |
| `planning` | clients, idées de contenu, tournages, publications, règles, rapports | `ERP-GDA-Aba/apps/planning` |
| `orange` | récolte, fabrication, entrepôt, distribution, emballage, approvisionnement | `Orange-full2/back` |
| `bdm` | campagnes, agences, ventes, enrôlements, primes, réclamations | `BDM/backend` |

---

## 4. Le front

Un shell Next.js unique, un module par service, la même grammaire partout :

- une **liste** filtrable, une **fiche**, un **formulaire** ;
- pour tout document validable : le **circuit** affiché en clair, et les
  actions que le rôle du lecteur autorise, jamais plus ;
- le menu et le tableau de bord se construisent depuis les habilitations
  renvoyées par `identity` — aucune liste en dur.

---

## 5. Règles qui ne se négocient pas

1. Un domaine = un service = ses tables. Personne d'autre n'y écrit ni n'y lit.
2. Aucune clé étrangère entre deux domaines : un identifiant nu plus un
   instantané des champs affichés.
3. Aucun import d'un modèle d'un autre domaine : tout passe par `api.py`.
4. Les vues ne portent pas de règle métier ; elle vit dans `services.py`.
5. Le format d'erreur, la pagination et l'authentification viennent du socle.
6. **Les tests d'un invariant s'écrivent avant le code du module concerné.**

---

## 6. Avancement

| Jalon | Contenu | Critère de sortie | État |
| ----- | ------- | ----------------- | ---- |
| M0 | Socle : passerelle, shell, `identity`, compte unique | Se connecter et voir ses applications | ✔ |
| M1 | `organisation` | L'organigramme réel est chargé et l'annuaire se parcourt | ✔ |
| M2 | Socle de validation dans `gdahub_common` | Un document traverse un circuit de bout en bout, testé | ✔ |
| M3 | `direction` | La console consolide, et tient quand un service se tait | ✔ |
| M4 | `rh` | Un congé posé suit son circuit jusqu'au solde décompté | ✔ |
| M5 | `finance` | Une dépense suit son circuit ; caisse, missions, achats | ✔ |
| M6 | Front Board | Les quatre modules du siège sont utilisables | ✔ |
| M7 | `daily` | Un chantier se suit au jour le jour | ✔ |
| M8 | `planning` | Un planning de publication se tient | ✔ |
| M9 | `orange` | La chaîne récolte → distribution est complète | ✔ |
| M10 | `bdm` | Une campagne se pilote de la vente au versement de la prime | ✔ |

**FinanceRH reste en production sur rh.gdamali.net pendant toute la durée du
chantier.** On lit son schéma et ses données ; on n'y touche pas. La bascule
ne se décide qu'une fois GDA Hub éprouvé sur un domaine complet.
