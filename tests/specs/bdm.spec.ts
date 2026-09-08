import { expect, test } from '@playwright/test';
import { cheminsInternes, connexionBdmDirecte, imagesChargees, surveiller } from '../aides';

/**
 * BDM servie sous /campagnes/ — le cas limite de la passerelle.
 *
 * Django sert ses propres pages par Inertia, avec un front compile par Vite.
 * Trois choses peuvent sortir du perimetre sans rien casser de visible : une
 * redirection ecrite en toutes lettres, un chemin d'image en dur, et les
 * imports dynamiques graves dans le bundle. Chacune envoie le navigateur a la
 * coquille du hub, qui repond du HTML.
 */

test('la connexion directe fonctionne, sans le hub', async ({ page }) => {
    const vigie = surveiller(page);
    await connexionBdmDirecte(page);
    expect(page.url()).toContain('/campagnes/');
    expect(page.url()).not.toContain('/login');
    await imagesChargees(page);
    vigie.estPropre();
});

test('le choix du client precede le tableau de bord', async ({ page }) => {
    await connexionBdmDirecte(page);
    // Un compte d'administration pilote plusieurs banques : sans client
    // choisi, les ecrans filtreraient sur rien et n'afficheraient rien.
    await expect(page).toHaveURL(/choix-client/);
    await expect(page.getByRole('heading', { name: /pour quel client/i })).toBeVisible();
    await expect(page.locator('main button')).not.toHaveCount(0);
});

test('choisir un client mene au tableau de bord', async ({ page }) => {
    const vigie = surveiller(page);
    await connexionBdmDirecte(page);
    await page.locator('main button').first().click();
    await page.waitForURL('**/campagnes/dashboard');
    await expect(page.getByRole('heading').first()).toBeVisible();
    await imagesChargees(page);
    vigie.estPropre();
});

test('aucune page ne pointe hors de /campagnes/', async ({ page }) => {
    await connexionBdmDirecte(page);
    await cheminsInternes(page, '/campagnes/');
    await page.locator('main button').first().click();
    await page.waitForURL('**/campagnes/dashboard');
    await cheminsInternes(page, '/campagnes/');
});

const ECRANS = [
    ['/campagnes/dashboard', 'le tableau de bord'],
    ['/campagnes/clients', 'les clients'],
    ['/campagnes/ventes', 'les ventes'],
    ['/campagnes/enrolements', 'les enrolements'],
    ['/campagnes/rapports', 'les rapports'],
    ['/campagnes/performances', 'les performances'],
    ['/campagnes/admin/campagnes', 'les campagnes'],
    ['/campagnes/admin/users', 'les comptes'],
    ['/campagnes/admin/agences', 'les agences'],
    ['/campagnes/admin/types-cartes', 'les types de cartes'],
    ['/campagnes/admin/journal-connexions', 'le journal des connexions'],
] as const;

for (const [chemin, quoi] of ECRANS) {
    test(`${quoi} s'affiche sans erreur`, async ({ page }) => {
        const vigie = surveiller(page);
        await connexionBdmDirecte(page);
        await page.locator('main button').first().click();
        await page.waitForURL('**/campagnes/dashboard');

        await page.goto(chemin);
        await page.waitForLoadState('networkidle');
        // Une page Inertia qui echoue laisse le conteneur vide : c'est le
        // symptome a attraper, pas seulement le code de reponse.
        await expect(page.locator('#app')).not.toBeEmpty();
        await expect(page.locator('main, [role=main]').first()).toBeVisible();
        await imagesChargees(page);
        await cheminsInternes(page, '/campagnes/');
        vigie.estPropre();
    });
}
