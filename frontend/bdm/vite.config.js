import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Le build produit frontend/dist ; Django lit le manifeste `.vite/manifest.json`
// pour retrouver les fichiers hachés (cf. backend/core/templatetags/vite.py).
// En développement, Django pointe directement vers ce serveur (port 5173).
export default defineConfig(({ command }) => ({
    // En production, Django sert les assets compilés sous /static/. Sans cette
    // base, Vite écrit des URL absolues en /assets/... dans le CSS et dans les
    // imports dynamiques des pages : polices et chunks partent en 404.
    // En développement, Vite sert depuis la racine de son propre serveur.
    base: command === 'build' ? '/static/' : '/',
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
    plugins: [react()],
    build: {
        manifest: true,
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            input: 'src/app.jsx',
        },
    },
    server: {
        port: 5173,
        strictPort: true,
        // Django sert les pages ; seuls les assets viennent d'ici.
        origin: 'http://localhost:5173',
        cors: true,
    },
}));
