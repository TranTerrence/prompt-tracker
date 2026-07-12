"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Lien de navigation avec état actif (correspondance exacte du chemin).
 */
export default function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-lg px-3 py-1.5 transition-colors ${
        active
          ? "bg-soft font-medium text-foreground"
          : "text-muted hover:bg-soft hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
