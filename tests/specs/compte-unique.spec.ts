import { expect, test } from '@playwright/test';
import { connexionHub, imagesChargees, surveiller } from '../aides';
import { HUB } from '../comptes';

/**
 * Le compte unique — la seule promesse du hub.
 *
 * « On se connecte une fois, on circule partout. » Tout le reste du projet
 * n'est que de la plomberie au service de cette phrase, et c'est donc ce
 * qu'il faut eprouver en premier.
 */

test('une connexion au hub ouvre BDM sans ressaisie', async ({ page }) => {
    const vigie = surveiller(page);

    await connexionHub(page);
    await expect(page.getByText(HUB.nomComplet.split(' ')[0], { exact: false }).first()).toBeVisible();

    const campagnes = page.getByRole('link', { name: 'Campagnes', exact: true }).first();
    await expect(campagnes).toHaveAttribute('href', '/campagnes/');
    await campagnes.click();

    // On arrive dans BDM, connecte, sans etre passe par son ecran de connexion.
    await page.waitForURL('**/campagnes/**');
    expect(page.url()).not.toContain('/campagnes/login');
    await expect(page).toHaveTitle(/Campagne BDM/);

    await imagesChargees(page);
    vigie.estPropre();
});

test('le compte sans adresse est rattache par son identifiant local dans BDM', async ({ page }) => {
    // Trente comptes de BDM sur soixante-quatre n'ont aucune adresse, dont
    // tous les comptes d'administration. Chercher par e-mail seul revenait a
    // dire que le compte unique ne marcherait jamais pour eux.
    await connexionHub(page);
    await page.getByRole('link', { name: 'Campagnes', exact: true }).first().click();
    await page.waitForURL('**/campagnes/**');

    await expect(page.getByText('Essai', { exact: false }).first()).toBeVisible();
});

test('le hub ne remplace pas la connexion de BDM', async ({ page, context }) => {
    // Sans jeton du hub, BDM doit continuer a servir son propre ecran : une
    // panne du hub ne doit pas arreter l'application.
    await context.clearCookies();

    // Le tableau de bord accueille les visiteurs anonymes — un titre et un
    // bouton, deliberement. Ce qu'il ne doit jamais faire, c'est laisser
    // paraitre un chiffre : ventes, commerciaux, campagnes.
    await page.goto('/campagnes/dashboard');
    await expect(page.getByRole('link', { name: /se connecter/i })).toBeVisible();
    // L'ecran anonyme n'est pas un layout applicatif : pas de <main>, juste un
    // titre et un bouton.
    const accueil = await page.locator('body').innerText();
    expect(accueil, 'des donnees paraissent sur l ecran anonyme').not.toMatch(/\d/);

    // Les ecrans qui portent des donnees, eux, renvoient a la connexion.
    for (const chemin of ['/campagnes/clients', '/campagnes/ventes', '/campagnes/admin/users']) {
        await page.goto(chemin);
        await expect(page, chemin).toHaveURL(/\/campagnes\/login/);
    }
    await expect(page.getByRole('button', { name: /se connecter/i }).first()).toBeVisible();
});

test('se deconnecter du hub ferme la session du hub', async ({ page }) => {
    await connexionHub(page);
    await page.getByRole('button', { name: /se deconnecter/i }).click();
    await page.waitForURL('**/connexion');
    await page.goto('/tableau-de-bord');
    await expect(page).toHaveURL(/\/connexion/);
});
