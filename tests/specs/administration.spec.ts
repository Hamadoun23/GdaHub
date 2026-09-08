import { expect, test, type Page } from '@playwright/test';
import { connexionHub, surveiller } from '../aides';
import { SIMPLE } from '../comptes';

/**
 * L'administration du hub — et le chainon qu'elle sert a remplir.
 *
 * Une habilitation accordee ne fait entrer personne tant que l'application ne
 * sait pas de qui il s'agit. Trente comptes de BDM sur soixante-quatre n'ont
 * aucune adresse : pour eux, seul `identifiant_local` peut faire le lien. Le
 * champ existait dans le modele et voyageait dans le jeton, mais l'API ne
 * l'exposait pas — il n'etait joignable que par l'administration Django.
 */

async function ouvrirAdministration(page: Page) {
    await connexionHub(page);
    await page.goto('/administration');
    await expect(page.getByRole('heading', { level: 1, name: 'Administration' })).toBeVisible();
    await expect(page.getByPlaceholder(/nom, adresse/i)).toBeVisible();
}

test('l ecran liste les comptes du groupe', async ({ page }) => {
    const vigie = surveiller(page);
    await ouvrirAdministration(page);
    await expect(page.getByRole('button', { name: /e2e@gdamali\.net/ })).toBeVisible();
    vigie.estPropre();
});

test('la recherche filtre la liste', async ({ page }) => {
    await ouvrirAdministration(page);
    await page.getByPlaceholder(/nom, adresse/i).fill('e2e-terrain');
    await expect(page.getByRole('button', { name: /e2e-terrain/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /e2e@gdamali\.net/ })).toHaveCount(0);
});

test('un compte sans adresse est signale comme non rattachable', async ({ page }) => {
    await ouvrirAdministration(page);
    // Le bandeau compte ceux qui ne pourront pas entrer : ni identifiant
    // local, ni adresse professionnelle.
    await expect(page.getByText(/compte.* sans rattachement/i)).toBeVisible();

    await page.getByPlaceholder(/nom, adresse/i).fill('e2e-terrain');
    await page.getByRole('button', { name: /e2e-terrain/ }).click();
    await expect(
        page.getByText(/n'a pas d'adresse professionnelle/i).first(),
    ).toBeVisible();
});

test('renseigner l identifiant local le rend rattachable, et ca tient', async ({ page }) => {
    await ouvrirAdministration(page);
    await page.getByPlaceholder(/nom, adresse/i).fill(SIMPLE.identifiant);
    await page.getByRole('button', { name: new RegExp(SIMPLE.identifiant) }).click();

    const champ = page.getByLabel(/identifiant dans campagnes/i);
    await expect(champ).toBeVisible();
    await champ.fill('70123456');
    await page.getByRole('button', { name: 'Enregistrer' }).click();

    // L'avertissement disparait : l'application sait desormais qui c'est.
    await expect(
        page.getByText(/n'a pas d'adresse professionnelle/i),
    ).toHaveCount(0);

    // Et surtout : la valeur a bien ete ecrite, pas seulement affichee.
    await page.reload();
    await page.getByPlaceholder(/nom, adresse/i).fill(SIMPLE.identifiant);
    await page.getByRole('button', { name: new RegExp(SIMPLE.identifiant) }).click();
    await expect(page.getByLabel(/identifiant dans campagnes/i)).toHaveValue('70123456');

    // On repose l'etat pour que la suite reste rejouable a l'identique.
    await page.getByLabel(/identifiant dans campagnes/i).fill('');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('Enregistre.')).toBeVisible();
});

test('l ecran est refuse a un compte sans droit d administration', async ({ page }) => {
    await connexionHub(page, SIMPLE);

    await page.goto('/administration');
    // Refuse, et dit pourquoi : une page vide laisserait croire a une panne.
    await expect(page.getByText(/reserve aux administrateurs/i)).toBeVisible();
});
