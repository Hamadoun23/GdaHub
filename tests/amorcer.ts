import { execFileSync } from 'node:child_process';

/**
 * Les comptes de test, crees dans les bases avant la premiere suite.
 *
 * Ils passent par `manage.py shell` dans les conteneurs plutot que par une API :
 * creer un compte du hub demande une habilitation, et creer un compte BDM
 * demande un hachage au format Laravel — deux choses qu'aucune API n'expose,
 * et pour de bonnes raisons.
 *
 * Tout est idempotent : relancer la suite ne cree pas de doublon.
 */

const IDENTITY = `
from comptes.models import Utilisateur, Application, Habilitation

compte, _ = Utilisateur.objects.get_or_create(
    identifiant='e2e@gdamali.net',
    defaults={'nom': 'Bout-en-bout', 'prenom': 'Essai'},
)
compte.set_password('E2e-GdaHub-2026!')
compte.est_actif = True
compte.save()

for code, roles, local in [('bdm', ['admin'], 'Essai E2E'), ('hub', ['admin'], '')]:
    application = Application.objects.filter(code=code).first()
    if application is None:
        continue
    habilitation, _ = Habilitation.objects.get_or_create(
        utilisateur=compte, application=application
    )
    habilitation.roles = roles
    habilitation.identifiant_local = local
    habilitation.active = True
    habilitation.save()

# Un compte ordinaire, sans droit sur le hub, et sans adresse : le cas des
# commerciaux de terrain. Il eprouve le refus d'acces et le signalement de
# rattachement impossible.
simple, _ = Utilisateur.objects.get_or_create(
    identifiant='e2e-terrain',
    defaults={'nom': 'Terrain', 'prenom': 'Essai'},
)
simple.set_password('E2e-Terrain-2026!')
simple.email = ''
simple.est_actif = True
simple.save()

application_bdm = Application.objects.filter(code='bdm').first()
if application_bdm is not None:
    lien, _ = Habilitation.objects.get_or_create(
        utilisateur=simple, application=application_bdm
    )
    lien.roles = ['commercial']
    lien.identifiant_local = ''
    lien.active = True
    lien.save()

print('IDENTITY OK')
`;

const BDM = `
from core.models import User, Role
from core.auth_backend import hacher_mot_de_passe

# Le compte que le hub rattache : sans adresse, comme les vrais comptes
# d'administration de BDM. C'est ce que le test doit eprouver.
via_hub = User.objects.filter(name='Essai E2E').first()
if via_hub is None:
    via_hub = User(name='Essai E2E', role=Role.ADMIN)
via_hub.role = Role.ADMIN
via_hub.email = None
via_hub.actif = True
via_hub.password = hacher_mot_de_passe('inutilise-le-hub-ouvre-la-session')
via_hub.save()

# Le compte a connexion directe : le chemin de bdm.gdamali.net, sans le hub.
direct = User.objects.filter(email='e2e@bdm.local').first()
if direct is None:
    direct = User(email='e2e@bdm.local', name='Essai Direct', role=Role.ADMIN)
direct.role = Role.ADMIN
direct.actif = True
direct.password = hacher_mot_de_passe('E2e-Bdm-2026!')
direct.save()

print('BDM OK')
`;

function semer(conteneur: string, script: string) {
    const sortie = execFileSync(
        'docker',
        ['exec', '-i', conteneur, 'python', 'manage.py', 'shell'],
        { input: script, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    if (!sortie.includes('OK')) {
        throw new Error(`Amorcage de ${conteneur} : reponse inattendue.\n${sortie}`);
    }
    console.log(`  ${conteneur} : comptes de test en place.`);
}

/**
 * Les routes visitees une fois, avant le premier test.
 *
 * En developpement, Next compile chaque route a sa premiere visite. Sans ce
 * prechauffage, c'est le premier test qui paie la compilation — il depassait
 * son delai, et le suivant, sur la meme page, passait en neuf secondes. Un
 * echec qui ne dit rien du produit est pire qu'un test absent : on apprend a
 * ne plus le croire.
 */
const A_PRECHAUFFER = [
    '/connexion',
    '/tableau-de-bord',
    '/mon-compte',
    '/administration',
    '/campagnes/login',
];

async function prechauffer(base: string) {
    for (const chemin of A_PRECHAUFFER) {
        try {
            await fetch(`${base}${chemin}`, { redirect: 'manual' });
        } catch {
            // La pile n'est peut-etre pas encore prete : les tests le diront
            // bien mieux que ce prechauffage.
        }
    }
}

export default async function amorcer() {
    console.log('Amorcage des comptes de test...');
    semer('gdahub-identity', IDENTITY);
    semer('gdahub-bdm', BDM);

    const base = process.env.GDAHUB_URL || 'http://localhost:8080';
    console.log('Prechauffage des routes...');
    await prechauffer(base);
}
