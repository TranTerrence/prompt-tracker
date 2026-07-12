import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Fraunces, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Prompt Tracker : Tableau de bord",
  description:
    "Tableau de bord de Prompt Tracker : suivez la qualité des prompts de votre équipe.",
};

/**
 * Résout la préférence « système » avant l'hydratation pour éviter tout
 * flash : si le cookie (ou localStorage) vaut "system", on applique le
 * thème résolu via prefers-color-scheme sur <html data-theme>.
 */
const themeScript = `(function(){try{var m=document.cookie.match(/(?:^|; )theme=([^;]+)/);var p=m?decodeURIComponent(m[1]):null;if(!p){try{p=localStorage.getItem("theme-pref")}catch(e){}}if(p==="system"){document.documentElement.dataset.theme=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}else if(p==="dark"||p==="light"){document.documentElement.dataset.theme=p}}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Lecture du thème côté serveur (cookie) : pas de flash au premier rendu.
  // Défaut : light. La valeur "system" est résolue côté client par le script.
  const store = await cookies();
  const pref = store.get("theme")?.value;
  const theme = pref === "dark" ? "dark" : "light";

  return (
    <html
      lang="fr"
      data-theme={theme}
      suppressHydrationWarning
      className={`${plexSans.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
