import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Les jetons d'invitation et les codes de classe voyagent dans le
        // CHEMIN. Un chemin part aussi dans l'en-tête Referer dès que la page
        // charge une ressource externe ou qu'on suit un lien sortant : c'est
        // ce header qu'il faut couper, pas le choix chemin/query.
        source: "/:path(invitation|join|extension)/:rest*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          // Ces pages portent une capacité : ni cache partagé, ni index.
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
