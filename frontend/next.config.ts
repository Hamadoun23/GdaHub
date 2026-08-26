import type { NextConfig } from "next";

const config: NextConfig = {
  // Le navigateur ne parle qu'a la passerelle : les appels d'API sont
  // relatifs (/api/...), il n'y a donc aucune URL a reecrire ici.
  reactStrictMode: true,
};

export default config;
