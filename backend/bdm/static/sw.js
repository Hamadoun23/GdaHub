/**
 * Service Worker — Gda Money PWA
 *
 * Met en cache les ressources immuables : le logo et les assets compilés par
 * Vite, dont le nom porte un hachage de contenu. Les pages et les appels
 * Inertia ne sont jamais servis depuis le cache : ils doivent toujours
 * refléter l'état réel des campagnes.
 */
const SW_PATH = self.location.pathname;
const BASE = SW_PATH.replace(/\/?sw\.js$/i, '');

function appPath(path) {
    const p = path.startsWith('/') ? path : '/' + path;
    return (BASE || '') + p;
}

// Version incrémentée à chaque changement de stratégie : l'ancien cache est
// supprimé à l'activation. Le passage de Laravel à Django change les chemins
// d'assets, d'où la v2.
const CACHE_NAME = 'gda-money-static-v2';

// Uniquement des ressources dont l'existence est certaine : `cache.addAll()`
// échoue en bloc si une seule répond 404, et le service worker ne s'installe
// alors jamais.
const PRECACHE_URLS = [
    appPath('/logo/iconesgda.png'),
    appPath('/logo/gdamoney.png'),
    appPath('/logo/gdamoney-mark.png'),
];

// Django sert les assets compilés sous /static/ ; Laravel les servait sous
// /build/. Le préfixe historique est conservé le temps que les anciens caches
// des navigateurs expirent.
const PREFIXES_CACHABLES = ['/logo/', '/static/assets/', '/build/assets/'];

function pathRelativeToApp(urlPath) {
    if (!BASE) return urlPath;
    if (urlPath.startsWith(BASE)) {
        const rest = urlPath.slice(BASE.length);
        return rest || '/';
    }
    return urlPath;
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            // Chaque ressource est ajoutée séparément : une absence ne doit pas
            // empêcher l'installation du service worker.
            .then((cache) =>
                Promise.all(
                    PRECACHE_URLS.map((url) =>
                        cache.add(url).catch(() => undefined)
                    )
                )
            )
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') {
        return;
    }
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) {
        return;
    }

    const rel = pathRelativeToApp(url.pathname);
    if (!PREFIXES_CACHABLES.some((prefixe) => rel.startsWith(prefixe))) {
        return;
    }

    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) {
                return cached;
            }
            return fetch(request).then((response) => {
                if (response.ok) {
                    const copie = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, copie));
                }
                return response;
            });
        })
    );
});
