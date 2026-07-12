import Header from "@/components/Header";
import type { Organization, Profile } from "@/lib/types";

/**
 * Applique le thème white-label de l'organisation (couleur d'accent)
 * et affiche le header avec logo et nom de marque.
 *
 * Quand l'organisation ne définit pas de couleur valide, on n'injecte
 * rien : l'accent par défaut (vert sauge) de chaque thème s'applique.
 */
export default function ThemedShell({
  org,
  profile,
  children,
}: {
  org: Organization;
  profile: Profile;
  children: React.ReactNode;
}) {
  const accent = /^#[0-9a-fA-F]{6}$/.test(org.brand_color ?? "")
    ? (org.brand_color as string)
    : null;

  return (
    <div
      className="flex min-h-screen flex-col"
      style={accent ? ({ "--accent": accent } as React.CSSProperties) : undefined}
    >
      <Header org={org} profile={profile} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        {children}
      </main>
    </div>
  );
}
