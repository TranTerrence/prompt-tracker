import { headers } from "next/headers";

export type InviteOutcome = {
  email: string;
  status: "invited" | "already_member" | "invalid";
  /** Présent seulement pour `invited`, et une seule fois : le lien à partager. */
  url?: string;
};

/**
 * Analyse une liste collée. Accepte `email` ou `email;Prénom Nom` par ligne
 * (et la virgule, parce que c'est ce que produit un export de tableur).
 * Le professeur colle sa liste de classe telle qu'il l'a.
 */
export function parseRoster(raw: string): { emails: string[]; names: (string | null)[] } {
  const emails: string[] = [];
  const names: (string | null)[] = [];
  const seen = new Set<string>();

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [rawEmail, ...rest] = trimmed.split(/[;,\t]/);
    const email = rawEmail.trim().toLowerCase();
    if (!email) continue;
    // Le dédoublonnage est fait ici : deux fois la même adresse dans un
    // copier-coller ne doit pas produire deux lignes de rapport.
    if (seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
    names.push(rest.join(" ").trim() || null);
  }
  return { emails, names };
}

/** Base absolue des liens d'invitation, déduite de la requête courante. */
export async function originOf(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "track-prompt.vercel.app";
  const proto = h.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

export function invitationUrl(origin: string, token: string): string {
  return `${origin}/invitation/${token}`;
}
