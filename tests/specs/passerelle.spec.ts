import { expect, test } from '@playwright/test';

/**
 * La passerelle : une origine, et chaque adresse chez le bon service.
 *
 * C'est la premiere chose a verifier apres un changement de nginx.conf. Une
 * regle mal placee ne casse rien de visible : elle envoie simplement une
 * adresse au mauvais service, qui repond sa propre page 404 en HTML. Le
 * navigateur affiche alors une image cassee, un manifeste illisible, ou une
 * page blanche — et on cherche le defaut dans l'application.
 */

const PAGES = [
    ['/', 'la coquille du hub'],
    ['/connexion', 'la connexion'],
    ['/tableau-de-bord', 'le tableau de bord'],
    ['/mon-compte', 'le compte'],
] as const;

for (const [chemin, quoi] of PAGES) {
    test(`${chemin} sert ${quoi}`, async ({ request }) => {
        const reponse = await request.get(chemin);
        expect(reponse.status()).toBe(200);
        expect(reponse.headers()['content-type']).toContain('text/html');
    });
}

test('les jetons sont verifiables : la cle publique est publiee', async ({ request }) => {
    const reponse = await request.get('/.well-known/jwks.json');
    expect(reponse.status()).toBe(200);
    const jwks = await reponse.json();
    expect(jwks.keys.length).toBeGreaterThan(0);
    expect(jwks.keys[0].kty).toBe('RSA');
});

test('les API refusent un appel sans jeton', async ({ request }) => {
    for (const chemin of ['/api/rh/', '/api/jus/']) {
        const reponse = await request.get(chemin);
        expect(reponse.status(), chemin).toBe(401);
    }
});

test('identity repond sur son propre prefixe', async ({ request }) => {
    // Contrairement aux autres, le prefixe d'identity n'est pas retire par la
    // passerelle : le retirer lui ferait chercher une adresse qui n'existe pas.
    const reponse = await request.post('/api/identity/auth/connexion', {
        data: { identifiant: 'inconnu@example.org', mot_de_passe: 'faux' },
        failOnStatusCode: false,
    });
    expect([400, 401]).toContain(reponse.status());
});

test('BDM est servie sous /campagnes/ et y reste', async ({ request }) => {
    const reponse = await request.get('/campagnes/', { maxRedirects: 0 });
    expect(reponse.status()).toBe(302);
    // La redirection doit rester dans le perimetre : sans FORCE_SCRIPT_NAME,
    // elle sortait vers « /login », qui appartient a la coquille du hub.
    expect(reponse.headers()['location']).toMatch(/^\/campagnes\//);
});

test('/campagnes sans barre oblique redirige, et pas definitivement', async ({ request }) => {
    const reponse = await request.get('/campagnes', { maxRedirects: 0 });
    // 307 et non 308 : un navigateur retient une redirection permanente pour
    // toujours, et on ne peut plus la lui reprendre.
    expect(reponse.status()).toBe(307);
    expect(reponse.headers()['location']).toBe('/campagnes/');
});

test('les fichiers statiques de BDM viennent de son propre prefixe', async ({ request }) => {
    const reponse = await request.get('/campagnes/static/logo/gdamoney-mark.png');
    expect(reponse.status()).toBe(200);
    expect(reponse.headers()['content-type']).toBe('image/png');
});

test('les sondes de vie repondent', async ({ request }) => {
    for (const chemin of ['/sante/identity', '/sante/jus']) {
        const reponse = await request.get(chemin, { failOnStatusCode: false });
        expect(reponse.status(), chemin).toBe(200);
    }
});
