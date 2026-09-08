# Tests de bout en bout

Ce qu'ils eprouvent : **ce que GDA Hub apporte**, et rien d'autre. Une origine
unique, un compte unique, des applications servies sous un chemin. Le reste —
la logique metier de chaque application — reste teste chez elle.

## Lancer

La pile doit tourner :

```sh
docker compose up -d
cd tests
npm install
npx playwright install chromium
npm test
```

`npm run rapport` ouvre le rapport HTML de la derniere execution.

## Pourquoi tout passe par la passerelle

Les tests s'adressent a `http://localhost:8080`, jamais a un service en direct.
Un test qui taperait `http://bdm:8000` passerait sans rien prouver : c'est
justement le fait d'etre servi sous `/campagnes/` qui casse les choses, et il
casse silencieusement.

Trois defauts de cette famille ont ete trouves ainsi, et aucun ne produisait
d'erreur visible :

- la table de routes `Ziggy` ne portait pas le prefixe : `route('login')`
  donnait `/login`, la racine du site. Le formulaire de connexion de BDM y
  postait, la coquille du hub repondait du HTML, et la connexion echouait sans
  un mot ;
- le nom du cookie CSRF etait ecrit en dur cote frontend alors que la
  passerelle oblige BDM a en changer : toute ecriture partait en 403 ;
- les logos etaient demandes a la racine du site, qui repondait sa page 404 en
  HTML — des images cassees, et rien dans la console.

## Les comptes

`amorcer.ts` cree, avant la premiere suite, des comptes prefixes `e2e` dans les
deux bases. Ils sont idempotents : relancer la suite ne cree pas de doublon.

| Compte | Ou | A quoi il sert |
| ------ | -- | -------------- |
| `e2e@gdamali.net` | identity | administrateur du hub ; ouvre BDM sans ressaisie |
| `e2e-terrain` | identity | compte ordinaire, sans adresse : eprouve le refus d'acces et le signalement de rattachement impossible |
| `Essai E2E` | BDM | compte **sans adresse**, rattache par `identifiant_local` |
| `e2e@bdm.local` | BDM | connexion directe, sans le hub |

Le compte BDM sans adresse n'est pas un detail de mise en scene : trente des
soixante-quatre comptes de BDM n'en ont aucune, dont tous les comptes
d'administration. C'est le cas que le compte unique doit couvrir, et il ne le
couvrait pas.

## Ce que couvre chaque fichier

| Fichier | Ce qu'il eprouve |
| ------- | ---------------- |
| `passerelle.spec.ts` | chaque adresse chez le bon service, les sondes de vie, le refus des API sans jeton |
| `hub.spec.ts` | connexion, session, annuaire des applications, refus d'une adresse inconnue |
| `compte-unique.spec.ts` | une connexion au hub ouvre BDM ; et le hub ne remplace pas la connexion de BDM |
| `administration.spec.ts` | l'ecran de correspondance des identifiants locaux, et sa protection |
| `bdm.spec.ts` | les onze ecrans de BDM, sans erreur, sans image cassee, sans lien sortant |
| `gabarits.spec.ts` | aucun commentaire ni balise de gabarit ne fuit dans la page |
| `pwa.spec.ts` | manifeste, service worker, portee, deuxieme visite servie par le cache |

## Les aides

`aides.ts` porte trois outils que la plupart des tests utilisent :

- `surveiller(page)` retient les erreurs de script et les requetes en echec, et
  `estPropre()` les affirme a la fin. Une page peut s'afficher parfaitement et
  demander trois fichiers qui repondent 404 ;
- `imagesChargees(page)` attrape les images cassees, que l'oeil voit mais
  qu'aucune assertion de texte ne verrait ;
- `cheminsInternes(page, prefixe)` verifie qu'aucun lien ni aucune image ne
  sort du perimetre de l'application.
