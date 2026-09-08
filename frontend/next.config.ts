import type { NextConfig } from "next";

const config: NextConfig = {
  // Le navigateur ne parle qu'a la passerelle : les appels d'API sont
  // relatifs (/api/...), il n'y a donc aucune URL a reecrire ici.
  reactStrictMode: true,
  // L'indicateur de dev de Next (le rond « N » en bas a gauche) ne sert
  // qu'en developpement local et n'apparait jamais en production ; il genait
  // la relecture visuelle des ecrans, desactive.
  devIndicators: false,
  // Le navigateur charge la page depuis la passerelle (127.0.0.1:8080), pas
  // depuis le serveur de dev Next lui-meme : sans cette liste, Next bloque
  // les requetes de ses propres chunks en 403 et la page reste blanche.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default config;
