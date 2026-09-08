import { expect, type Page } from '@playwright/test';
import { BDM_DIRECT, HUB } from './comptes';

/**
 * Ouvre une session sur le hub et attend le tableau de bord.
 *
 * Prend des identifiants en parametre : c'est la meme mecanique de connexion
 * pour le compte administrateur de test et pour un compte ordinaire, et une
 * seule version doit exister pour porter le correctif ci-dessous.
 */
export async function connexionHub(
    page: Page,
    identifiants: { identifiant: string; motDePasse: string } = HUB,
) {
    await page.goto('/connexion');
    // Le bouton reste desactive tant que React ne s'est pas accroche a la
    // page : c'est ce qui protege un utilisateur reel d'un clic trop rapide,
    // qui declencherait sinon la soumission HTML native du formulaire — un
    // GET qui envoie l'identifiant et le mot de passe en clair dans l'URL, et
    // renvoie silencieusement sur l'ecran de connexion, vide. Le meme filet
    // retarde ici un clic donne avant l'hydratation ; on l'attend donc plutot
    // que de le contourner.
    //
    // `:visible` : la page rend deux formulaires (mobile et desktop, bascule
    // en CSS selon la largeur), donc deux boutons de validation dans le DOM.
    // Seul l'un des deux est affiche pour une taille d'ecran donnee.
    const bouton = page.locator('button[type=submit]:visible');
    await expect(bouton).toBeEnabled();
    await page.locator('#identifiant:visible, #identifiant-mobile:visible').fill(identifiants.identifiant);
    await page.locator('#mot-de-passe:visible, #mot-de-passe-mobile:visible').fill(identifiants.motDePasse);
    await bouton.click();
    await page.waitForURL('**/tableau-de-bord');
}

/** Ouvre une session BDM par son propre ecran de connexion, sans le hub. */
export async function connexionBdmDirecte(page: Page) {
    await page.goto('/campagnes/login');
    // « Identifiant » et non « E-mail » : BDM accepte aussi le telephone et,
    // pour l'administration, le nom. Trente de ses comptes n'ont pas d'adresse.
    // Par role : « Mot de passe » designe aussi le bouton qui devoile la
    // saisie, et un simple libelle en attraperait deux.
    await page.getByRole('textbox', { name: 'Identifiant' }).fill(BDM_DIRECT.email);
    await page.getByRole('textbox', { name: 'Mot de passe' }).fill(BDM_DIRECT.motDePasse);
    await page.getByRole('button', { name: /se connecter/i }).click();
    await page.waitForURL((url) => !url.pathname.endsWith('/login'));
}

/**
 * Enregistre tout ce qu'une page rate, pour l'affirmer a la fin du test.
 *
 * Une page peut s'afficher correctement et pourtant demander trois fichiers
 * qui repondent 404 : c'est exactement ce qui arrivait aux logos servis sous
 * un chemin. L'oeil ne le voit pas ; le reseau, si.
 */
export function surveiller(page: Page) {
    const erreurs: string[] = [];
    const echecs: string[] = [];

    page.on('pageerror', (e) => erreurs.push(e.message));
    page.on('console', (m) => {
        if (m.type() === 'error') erreurs.push(m.text());
    });
    page.on('requestfailed', (r) => {
        echecs.push(`${r.url()} — ${r.failure()?.errorText}`);
    });
    page.on('response', (r) => {
        if (r.status() >= 400) echecs.push(`${r.status()} ${r.url()}`);
    });

    return {
        erreurs,
        echecs,
        /** Aucune erreur de script, aucune requete en echec. */
        estPropre(exceptions: RegExp[] = []) {
            const filtre = (l: string) => !exceptions.some((e) => e.test(l));
            expect(erreurs.filter(filtre), 'erreurs de script').toEqual([]);
            expect(echecs.filter(filtre), 'requetes en echec').toEqual([]);
        },
    };
}

/** Verifie qu'aucune image de la page n'est cassee. */
export async function imagesChargees(page: Page) {
    const cassees = await page.evaluate(() =>
        [...document.images]
            .filter((i) => i.currentSrc && (!i.complete || i.naturalWidth === 0))
            .map((i) => i.currentSrc),
    );
    expect(cassees, 'images cassees').toEqual([]);
}

/** Verifie qu'aucun lien ni actif ne pointe hors du perimetre de l'application. */
export async function cheminsInternes(page: Page, prefixe: string) {
    const sortants = await page.evaluate((p) => {
        const interne = (v: string | null) =>
            !v || !v.startsWith('/') || v.startsWith('//') || v.startsWith(p);
        const hors: string[] = [];
        document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
            const href = a.getAttribute('href');
            // Le retour au hub est deliberement absolu : il quitte l'application.
            if (href === '/') return;
            if (!interne(href)) hors.push(`a[href=${href}]`);
        });
        document.querySelectorAll<HTMLImageElement>('img[src]').forEach((i) => {
            const src = i.getAttribute('src');
            if (!interne(src)) hors.push(`img[src=${src}]`);
        });
        return hors;
    }, prefixe);
    expect(sortants, `chemins hors de ${prefixe}`).toEqual([]);
}
