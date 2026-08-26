import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './src/**/*.{js,jsx}',
        // Gabarit racine servi par Django (ex-app.blade.php).
        '../backend/templates/**/*.html',
    ],

    theme: {
        extend: {
            fontFamily: {
                // Inter (auto-hébergée via @fontsource) pour une UI plus nette. Futura reste
                // réservée à la marque (logo/wordmark) via `font-brand`.
                sans: [
                    'Inter',
                    '-apple-system',
                    'BlinkMacSystemFont',
                    '"Segoe UI"',
                    'Roboto',
                    '"Helvetica Neue"',
                    'Arial',
                    ...defaultTheme.fontFamily.sans,
                ],
                brand: [
                    'Futura',
                    '"Futura PT"',
                    '"Futura Std"',
                    '"Century Gothic"',
                    '"Trebuchet MS"',
                    ...defaultTheme.fontFamily.sans,
                ],
            },
            colors: {
                gda: {
                    brun: '#381419',
                    gris: '#303030',
                    cuivre: '#b26440',
                    orange: '#FF6A3A',
                    blanc: '#ffffff',
                },
            },
            boxShadow: {
                card: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.04)',
            },
        },
    },

    plugins: [forms],
};
