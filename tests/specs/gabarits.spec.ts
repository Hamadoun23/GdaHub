import { expect, test } from '@playwright/test';

/**
 * Ce que les gabarits ne doivent jamais laisser passer.
 *
 * Django ne reconnait la forme courte du commentaire — accolade, diese —
 * que sur une seule ligne. Etalee sur deux, il l'ecrit dans la page. Le
 * defaut est invisible a la relecture du gabarit et parfaitement visible a
 * l'ecran : le commentaire s'affiche en haut, avant tout le reste.
 */

const PAGES = ['/campagnes/login', '/campagnes/forgot-password'];

for (const chemin of PAGES) {
    test(`${chemin} ne laisse fuir aucun commentaire de gabarit`, async ({ request }) => {
        const html = await (await request.get(chemin)).text();
        expect(html, 'commentaire Django non interprete').not.toContain('{#');
        expect(html, 'balise de gabarit non interpretee').not.toMatch(/\{%\s*(url|static|comment)/);
        expect(html, 'variable de gabarit non interpretee').not.toMatch(/\{\{\s*\w+\s*\}\}/);
    });
}

test('le prefixe des fichiers statiques est transmis au frontend', async ({ request }) => {
    const html = await (await request.get('/campagnes/login')).text();
    // Sans lui, les pages React retombent sur « /static/ », qui appartient a
    // un autre service derriere la meme passerelle.
    expect(html).toContain('window.BdmStatique = "/campagnes/static/"');
});

test('la table de routes porte le prefixe de service', async ({ request }) => {
    const html = await (await request.get('/campagnes/login')).text();
    const trouve = html.match(/window\.Ziggy = (\{.*?\});<\/script>/s);
    expect(trouve, 'window.Ziggy absent de la page').not.toBeNull();

    const ziggy = JSON.parse(trouve![1]);
    // Ziggy colle `url` devant l'URI de chaque route. Sans le prefixe,
    // route('login') donnait « /login » — la racine du site, qui appartient a
    // la coquille du hub. Le formulaire de connexion y postait, le hub
    // repondait du HTML, et la connexion echouait sans un mot.
    expect(ziggy.url).toMatch(/\/campagnes$/);
    expect(ziggy.routes.login.uri).toBe('login');
});
