import { defineConfig, devices } from '@playwright/test';

/**
 * Les tests de bout en bout de GDA Hub.
 *
 * Ils s'adressent a la passerelle, jamais a un service en direct : c'est la
 * seule facon d'eprouver ce que le hub apporte reellement — une origine
 * unique, un compte unique, et des applications servies sous un chemin. Un
 * test qui tape http://bdm:8000 passerait sans rien prouver.
 *
 * La pile doit tourner : `docker compose up -d`.
 */
export default defineConfig({
    testDir: './specs',
    fullyParallel: false,
    workers: 1,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    // Genereux, et pour une raison precise : en developpement, Next compile
    // chaque route a sa premiere visite, ce qui coute vingt a quarante secondes
    // une fois par route. `amorcer.ts` les prechauffe, mais BDM rend ses pages
    // par un serveur de developpement Django qui n'est pas rapide non plus.
    timeout: 90_000,
    expect: { timeout: 15_000 },
    globalSetup: './amorcer.ts',
    reporter: [['list'], ['html', { open: 'never', outputFolder: 'rapport' }]],
    use: {
        baseURL: process.env.GDAHUB_URL || 'http://localhost:8080',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        locale: 'fr-FR',
        timezoneId: 'Africa/Bamako',
        // L'ecran de connexion de BDM anime un degrade plein ecran, image
        // apres image. Playwright n'attend jamais qu'un element se stabilise
        // sous une animation continue, et le clic n'aboutissait pas. La
        // reponse n'est pas de contourner l'attente : c'est que la page doit
        // respecter le reglage du systeme, ce qu'elle fait desormais. Les
        // tests se declarent donc comme un poste qui demande moins d'animation
        // — ce que fait aussi le telephone d'un commercial qui a coche
        // « reduire les animations ».
        reducedMotion: 'reduce',
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        // Les commerciaux saisissent leurs ventes au telephone, sur le terrain :
        // les ecrans de saisie doivent tenir sur un ecran de poche.
        { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ },
    ],
});
