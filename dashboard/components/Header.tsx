import Link from "next/link";
import NavLink from "@/components/NavLink";
import ThemeToggle from "@/components/ThemeToggle";
import type { Organization, Profile } from "@/lib/types";

export default function Header({
  org,
  profile,
}: {
  org: Organization;
  profile: Profile;
}) {
  const brand = org.brand_name || org.name || "Prompt Tracker";
  const isAdmin = profile.role === "admin";

  return (
    <header className="sticky top-0 z-10 border-b border-card-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
        <Link href="/" className="flex items-center gap-3">
          {org.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={org.logo_url}
              alt={`Logo ${brand}`}
              className="h-8 w-8 rounded-lg object-contain"
            />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent font-display text-sm font-semibold text-white">
              {brand.slice(0, 2).toUpperCase()}
            </span>
          )}
          <span className="font-display text-lg font-semibold tracking-tight">
            {brand}
          </span>
        </Link>

        <nav className="flex flex-1 flex-wrap items-center gap-1 text-sm">
          {isAdmin && (
            <>
              <NavLink href="/admin">Vue d&apos;ensemble</NavLink>
              <NavLink href="/admin/users">Utilisateurs</NavLink>
              <NavLink href="/admin/settings">Paramètres</NavLink>
              <NavLink href="/admin/export">Export</NavLink>
            </>
          )}
          <NavLink href="/me">Ma progression</NavLink>
        </nav>

        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-muted lg:inline">
            {profile.display_name || profile.email}
          </span>
          <ThemeToggle />
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-lg border border-card-border px-3 py-1.5 text-muted transition-colors hover:bg-soft hover:text-foreground"
            >
              Déconnexion
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
