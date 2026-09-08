import { expect, test } from '@playwright/test';
import { connexionBdmDirecte } from '../aides';

/**
 * L'application installable des commerciaux de terrain.
 *
 * Ils saisissent leurs ventes sur un telephone, souvent en bord de reseau.
 * Une PWA qui ne s'installe pas les renvoie au navigateur, et l'echec est
 * silencieux : l'enregistrement rate part dans un `catch`, et personne ne
 * s'en apercoit avant que quelqu'un se plaigne de ne pas trouver l'icone.
 */

test('le manifeste designe l application, pas la racine du site', async ({ request }) => {
    const reponse = await request.get('/campagnes/site.webmanifest');
    expect(reponse.status()).toBe(200);
    expect(reponse.headers()['content-type']).toContain('application/manifest+json');

    const manifeste = await reponse.json();
    // Figes sur « / », ils ouvraient l'accueil du hub : l'application
    // installee sur le telephone d'un commercial ne montrait pas ses ventes.
    expect(manifeste.start_url).toBe('/campagnes/');
    expect(manifeste.scope).toBe('/campagnes/');
    expect(manifeste.icons.length).toBeGreaterThan(0);
});

test('les icones du manifeste existent vraiment', async ({ request }) => {
    const manifeste = await (await request.get('/campagnes/site.webmanifest')).json();
    for (const icone of manifeste.icons) {
        const reponse = await request.get(icone.src);
        expect(reponse.status(), icone.src).toBe(200);
        expect(reponse.headers()['content-type'], icone.src).toContain('image');
    }
});

test('le service worker est servi a la racine de l application', async ({ request }) => {
    // Un navigateur limite la portee d'un service worker a son propre dossier.
    // Servi sous /campagnes/static/, il ne pouvait pas couvrir /campagnes/.
    const reponse = await request.get('/campagnes/sw.js');
    expect(reponse.status()).toBe(200);
    expect(reponse.headers()['content-type']).toContain('javascript');
});

test('le service worker prend bien la portee de l application', async ({ page }) => {
    await connexionBdmDirecte(page);
    await page.waitForLoadState('networkidle');

    const portees = await page.evaluate(async () => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        return registrations.map((r) => r.scope);
    });
    expect(portees.some((p) => p.endsWith('/campagnes/'))).toBe(true);
});

test('la page reste correcte a la deuxieme visite, servie par le cache', async ({ page }) => {
    await connexionBdmDirecte(page);
    await page.waitForLoadState('networkidle');
    await page.reload({ waitUntil: 'networkidle' });

    const controlee = await page.evaluate(() => !!navigator.serviceWorker.controller);
    expect(controlee).toBe(true);
    await expect(page.getByRole('heading', { name: /pour quel client/i })).toBeVisible();
});
