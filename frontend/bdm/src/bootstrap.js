import axios from 'axios';
window.axios = axios;

window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

// Noms de cookie et d'en-tête CSRF côté Django. Par défaut, axios cherche le
// cookie `XSRF-TOKEN` et envoie `X-XSRF-TOKEN` — les noms de Laravel, d'où le
// fait que rien n'avait à être configuré jusqu'ici. Django pose `csrftoken` et
// attend `X-CSRFToken` : sans ces deux lignes, axios ne trouve pas le cookie,
// n'envoie aucun en-tête, et toute requête POST est rejetée en 403.
//
// Inertia utilise l'instance globale d'axios : ces réglages s'appliquent aussi
// à `router.post()` et à `useForm()`.
window.axios.defaults.xsrfCookieName = 'csrftoken';
window.axios.defaults.xsrfHeaderName = 'X-CSRFToken';
