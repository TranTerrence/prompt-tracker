import type { Metadata } from "next";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Politique de confidentialité — Prompt Tracker",
  description:
    "Politique de confidentialité de Prompt Tracker : analyse locale des prompts, synchronisation limitée aux métadonnées, hébergement en Union européenne.",
};

const LAST_UPDATE = "12 juillet 2026";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-card-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-3">
          <Link href="/login" className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent font-display text-sm font-semibold text-white">
              PT
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">
              Prompt Tracker
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/login"
              className="rounded-lg border border-card-border px-3 py-1.5 text-sm text-muted transition-colors hover:bg-soft hover:text-foreground"
            >
              Se connecter
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        {/* ------------------------------------------------------------- */}
        {/* Version française                                              */}
        {/* ------------------------------------------------------------- */}
        <article className="space-y-8">
          <div>
            <p className="text-[13px] uppercase tracking-wider text-muted">
              Dernière mise à jour : {LAST_UPDATE}
            </p>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">
              Politique de confidentialité
            </h1>
            <p className="mt-4 leading-relaxed text-muted">
              Prompt Tracker est une extension de navigateur qui vous aide à
              améliorer la qualité de vos prompts avant leur envoi à un
              assistant IA. Cette page décrit précisément quelles données sont
              traitées, où et pourquoi.{" "}
              <a href="#en" className="font-medium text-accent hover:underline">
                English version below ↓
              </a>
            </p>
          </div>

          <Section title="1. Fonctionnement local par défaut">
            <p className="leading-relaxed text-muted">
              Sans compte, l&apos;extension fonctionne entièrement en local :
              vos prompts sont analysés directement dans votre navigateur.
              Aucune donnée — ni texte, ni métadonnée — n&apos;est envoyée vers
              un serveur. Rien ne quitte votre machine tant que vous ne
              connectez pas un compte d&apos;organisation.
            </p>
          </Section>

          <Section title="2. Avec un compte d'organisation">
            <p className="leading-relaxed text-muted">
              Si votre organisation vous fournit un compte, l&apos;extension
              synchronise des <strong className="text-foreground">métadonnées</strong>{" "}
              vers le tableau de bord de votre organisation :
            </p>
            <ul className="list-disc space-y-1.5 pl-5 leading-relaxed text-muted">
              <li>catégorie du prompt et site utilisé ;</li>
              <li>scores de qualité (clarté, contexte, itération, critique) ;</li>
              <li>
                compteurs : nombre de mots, interceptions, issues (amélioré,
                envoyé, annulé), tours de réflexion.
              </li>
            </ul>
            <p className="leading-relaxed text-muted">
              Le <strong className="text-foreground">texte de vos prompts
              n&apos;est jamais synchronisé</strong>, sauf si votre organisation
              active explicitement le mode « texte complet ». Lorsque ce mode
              est désactivé, un déclencheur côté serveur efface
              systématiquement tout texte reçu : il n&apos;est ni stocké ni
              consultable.
            </p>
          </Section>

          <Section title="3. Hébergement en Union européenne">
            <p className="leading-relaxed text-muted">
              Les données synchronisées sont hébergées par Supabase dans
              l&apos;Union européenne (région Paris, France). Elles ne sont ni
              vendues, ni partagées avec des tiers, ni utilisées à des fins
              publicitaires.
            </p>
          </Section>

          <Section title="4. Vos droits (RGPD)">
            <p className="leading-relaxed text-muted">
              Conformément au Règlement général sur la protection des données,
              vous disposez notamment d&apos;un droit d&apos;accès, de
              rectification et de suppression de vos données. Vous pouvez
              exercer ces droits à tout moment en écrivant à l&apos;adresse
              ci-dessous ; la suppression de votre compte entraîne la
              suppression de vos données associées.
            </p>
          </Section>

          <Section title="5. Contact">
            <p className="leading-relaxed text-muted">
              Pour toute question relative à cette politique ou à vos données :{" "}
              <a
                href="mailto:terrence.tran0@gmail.com"
                className="font-medium text-accent hover:underline"
              >
                terrence.tran0@gmail.com
              </a>
            </p>
          </Section>
        </article>

        <hr className="my-14 border-card-border" />

        {/* ------------------------------------------------------------- */}
        {/* English version                                                */}
        {/* ------------------------------------------------------------- */}
        <article id="en" lang="en" className="scroll-mt-20 space-y-8">
          <div>
            <p className="text-[13px] uppercase tracking-wider text-muted">
              Last updated: July 12, 2026
            </p>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">
              Privacy Policy
            </h1>
            <p className="mt-4 leading-relaxed text-muted">
              Prompt Tracker is a browser extension that helps you improve the
              quality of your prompts before they are sent to an AI assistant.
              This page describes exactly what data is processed, where, and
              why.
            </p>
          </div>

          <Section title="1. Local by default">
            <p className="leading-relaxed text-muted">
              Without an account, the extension runs entirely locally: your
              prompts are analyzed directly in your browser. No data — neither
              text nor metadata — is sent to any server. Nothing leaves your
              machine unless you sign in with an organization account.
            </p>
          </Section>

          <Section title="2. With an organization account">
            <p className="leading-relaxed text-muted">
              If your organization provides you with an account, the extension
              syncs <strong className="text-foreground">metadata</strong> to
              your organization&apos;s dashboard:
            </p>
            <ul className="list-disc space-y-1.5 pl-5 leading-relaxed text-muted">
              <li>prompt category and the site used;</li>
              <li>quality scores (clarity, context, iteration, critique);</li>
              <li>
                counters: word count, interceptions, outcomes (improved, sent,
                cancelled), reflection rounds.
              </li>
            </ul>
            <p className="leading-relaxed text-muted">
              The <strong className="text-foreground">text of your prompts is
              never synced</strong> unless your organization explicitly enables
              the “full text” mode. When that mode is disabled, a server-side
              trigger systematically erases any received text: it is neither
              stored nor accessible.
            </p>
          </Section>

          <Section title="3. Hosted in the European Union">
            <p className="leading-relaxed text-muted">
              Synced data is hosted by Supabase in the European Union (Paris
              region, France). It is never sold, shared with third parties, or
              used for advertising.
            </p>
          </Section>

          <Section title="4. Your rights (GDPR)">
            <p className="leading-relaxed text-muted">
              Under the General Data Protection Regulation, you have the right
              to access, rectify, and delete your data. You can exercise these
              rights at any time by writing to the address below; deleting your
              account deletes the data associated with it.
            </p>
          </Section>

          <Section title="5. Contact">
            <p className="leading-relaxed text-muted">
              For any question about this policy or your data:{" "}
              <a
                href="mailto:terrence.tran0@gmail.com"
                className="font-medium text-accent hover:underline"
              >
                terrence.tran0@gmail.com
              </a>
            </p>
          </Section>
        </article>
      </main>

      <footer className="border-t border-card-border">
        <div className="mx-auto max-w-3xl px-6 py-6 text-center text-xs text-muted">
          Prompt Tracker — Le garde-fou de votre prompting
        </div>
      </footer>
    </div>
  );
}
