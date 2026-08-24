"""Routes de l'API identity, montees sous /api/identity/."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from comptes import views

routeur = DefaultRouter()
routeur.register("utilisateurs", views.UtilisateurViewSet, basename="utilisateur")
routeur.register("applications", views.ApplicationViewSet, basename="application")
routeur.register("habilitations", views.HabilitationViewSet, basename="habilitation")
routeur.register("connexions", views.JournalConnexionViewSet, basename="connexion")

urlpatterns = [
    path("auth/connexion", views.Connexion.as_view(), name="connexion"),
    path("auth/rafraichir", views.Rafraichir.as_view(), name="rafraichir"),
    path("auth/deconnexion", views.Deconnexion.as_view(), name="deconnexion"),
    path("auth/moi", views.MonCompte.as_view(), name="moi"),
    path(
        "auth/mot-de-passe",
        views.ChangerMotDePasse.as_view(),
        name="changer-mot-de-passe",
    ),
    path("", include(routeur.urls)),
]
