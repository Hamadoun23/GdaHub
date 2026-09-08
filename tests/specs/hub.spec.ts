import { expect, test } from '@playwright/test';
import { connexionHub, imagesChargees, surveiller } from '../aides';
import { HUB } from '../comptes';

/** La coquille du hub : connexion, annuaire des applications, compte. */

test('un mot de passe faux ne laisse pas entrer, et le dit', async ({ page }) => {
    await page.goto('/connexion');
    // Le bouton reste desactive jusqu'a l'hydratation ; cf. aides.ts.
    // `:visible` : deux formulaires existent dans le DOM (mobile et
    // desktop) ; un seul est affiche selon la largeur d'ecran.
    const bouton = page.locator('button[type=submit]:visible');
    await expect(bouton).toBeEnabled();
    await page.locator('#identifiant:visible, #identifiant-mobile:visible').fill(HUB.identifiant);
    await page.locator('#mot-de-passe:visible, #mot-de-passe-mobile:visible').fill('ce-n-est-pas-le-bon');
    await bouton.click();

    await expect(page).toHaveURL(/\/connexion/);
    // Un echec muet laisse l'utilisateur cliquer indefiniment.
    await expect(page.getByText(/identifiant|mot de passe|incorrect/i).first()).toBeVisible();
});

test('la session survit a un rechargement', async ({ page }) => {
    await connexionHub(page);
    await page.reload();
    await expect(page).toHaveURL(/\/tableau-de-bord/);
    await expect(page.getByRole('button', { name: /se deconnecter/i })).toBeVisible();
});

test('une adresse protegee renvoie vers la connexion', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/tableau-de-bord');
    await expect(page).toHaveURL(/\/connexion/);
});

test('le tableau de bord ne montre que les applications habilitees', async ({ page }) => {
    const vigie = surveiller(page);
    await connexionHub(page);

    await expect(page.getByRole('link', { name: 'Campagnes', exact: true }).first()).toBeVisible();
    // Le compte de test n'a pas d'habilitation sur RH ni sur Jus : ces
    // applications ne doivent pas apparaitre. Le menu se construit a partir du
    // jeton, jamais d'une liste ecrite en dur.
    await expect(page.getByRole('link', { name: /ressources humaines/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /jus d'orange/i })).toHaveCount(0);

    await imagesChargees(page);
    vigie.estPropre();
});

test('le nom mene au compte', async ({ page }) => {
    await connexionHub(page);
    await page.getByRole('link', { name: new RegExp(HUB.nomComplet.split(' ')[0], 'i') }).first().click();
    await expect(page).toHaveURL(/\/mon-compte/);
});

test('une adresse d application inconnue ne revele rien', async ({ page }) => {
    await connexionHub(page);
    await page.goto('/comptabilite');
    // « N'existe pas » et « pas pour vous » doivent se ressembler.
    await expect(page.getByText(/indisponible/i).first()).toBeVisible();
});
