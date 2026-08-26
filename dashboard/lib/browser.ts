import { headers } from "next/headers";

/**
 * Famille de navigateur du visiteur, lue du User-Agent côté serveur.
 *
 * Grossier à dessein, comme le `deviceHint()` de l'extension : le résultat ne
 * sert qu'à pré-sélectionner un onglet de consignes sur /install, et le
 * visiteur peut toujours basculer à la main. L'ordre des tests compte :
 * Firefox s'annonce sans « Chrome/ », mais Edge, Opera, Brave et Arc
 * s'annoncent tous avec — donc Firefox d'abord, puis la famille Chromium.
 * « other » (Safari, mobiles, inconnus) retombe sur les consignes Chromium,
 * avec un bandeau qui dit pourquoi.
 */
export type BrowserFamily = "chromium" | "firefox" | "other";

export async function detectBrowser(): Promise<BrowserFamily> {
  const ua = (await headers()).get("user-agent") ?? "";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Chrome\/|Chromium\/|Edg\/|OPR\//.test(ua)) return "chromium";
  return "other";
}
