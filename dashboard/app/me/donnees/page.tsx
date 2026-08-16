import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Consent, OrgDataRequest } from "@/lib/types";
import ConsentForm from "./consent-form";

/**
 * « Mes données partagées », côté web.
 *
 * Ces réglages n'existaient que dans l'extension : un étudiant qui la
 * désinstalle, change d'ordinateur ou quitte l'établissement n'avait plus
 * aucun moyen de révoquer son consentement ni de demander l'effacement de ce
 * qui avait déjà été envoyé. C'est un droit RGPD, il ne peut pas dépendre d'un
 * logiciel installé.
 */
export default async function DonneesPage() {
  const { userId, org } = await requireSession();
  const supabase = await createClient();

  const [{ data: requests }, { data: consents }] = await Promise.all([
    supabase
      .from("org_data_requests")
      .select("org_id, category, requested, purpose")
      .eq("org_id", org.id),
    supabase.from("consents").select("user_id, category, granted").eq("user_id", userId),
  ]);

  const granted: Record<string, boolean> = {};
  for (const c of (consents ?? []) as Consent[]) granted[c.category] = c.granted;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link href="/me" className="text-sm text-muted hover:text-accent">
          ← Ma progression
        </Link>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Mes données partagées avec {org.brand_name || org.name}
        </h1>
        <p className="text-muted">
          C&apos;est toi qui décides, catégorie par catégorie. Modifiable à tout
          moment, ici ou depuis l&apos;extension.
        </p>
      </div>

      <ConsentForm
        orgName={org.brand_name || org.name}
        requests={(requests ?? []) as OrgDataRequest[]}
        granted={granted}
      />

      <p className="text-xs text-muted">
        Le détail de ce qui est collecté, pourquoi et pour combien de temps vit
        dans la{" "}
        <Link href="/privacy" className="text-accent hover:underline">
          politique de confidentialité
        </Link>
        .
      </p>
    </div>
  );
}
