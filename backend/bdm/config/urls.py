"""
Table des URLs — miroir de routes/web.php et routes/auth.php.

Les noms de routes doivent rester strictement identiques à ceux de Laravel :
ils alimentent le helper `route()` du frontend (cf. core.routes).
"""

from django.conf import settings
from django.urls import include, path, re_path
from django.views.static import serve

urlpatterns = [
    path("", include("campagnes.urls")),
    path("", include("rapports.urls")),
    path("", include("terrain.urls")),
    path("", include("core.urls")),
    # Fichiers téléversés (pièces d'identité) — équivalent du lien symbolique
    # `storage` de Laravel. En production, nginx sert ce chemin directement ;
    # la vue reste utile en développement et comme filet de sécurité.
    path(
        "storage/<path:path>",
        serve,
        {"document_root": settings.MEDIA_ROOT},
        name="storage.local",
    ),
    # Assets que Laravel servait depuis la racine de `public/`. Le frontend les
    # référence en dur (`/logo/gdamoney-mark.png`) et le service worker doit
    # rester à la racine pour couvrir tout le site : on conserve donc ces URLs
    # plutôt que de modifier les pages React.
    re_path(
        r"^(?P<path>logo/.+|sw\.js|favicon\.ico|robots\.txt)$",
        serve,
        {"document_root": settings.BASE_DIR / "static"},
        name="public.racine",
    ),
]
