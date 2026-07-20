import type { Metadata } from "next";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Installer l'extension : Prompt Tracker",
  description:
    "Installer l'extension Chrome Prompt Tracker : interception socratique de vos prompts sur ChatGPT, Claude, Gemini, Mistral et Grok, analyse 100 % locale.",
};

const DIRECT_ZIP = "/downloads/prompt-tracker-latest.zip";
const VERSION = "0.6.0";

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 font-display text-sm font-semibold text-accent">
        {n}
      </span>
      <div className="space-y-1.5">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <div className="text-sm leading-relaxed text-muted">{children}</div>
      </div>
    </li>
  );
}

export default function InstallPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-card-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-3">
          <Link href="/login" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" className="h-8 w-8 rounded-lg" />
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
        <article className="space-y-10">
          <div className="space-y-3">
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              Installer l&apos;extension
            </h1>
            <p className="text-muted">
              Prompt Tracker ajoute une pause réfléchie avant vos prompts sur
              ChatGPT, Claude, Gemini, Mistral (Le Chat) et Grok. Rien
              n&apos;est enregistré avant votre accord explicite au premier
              lancement, l&apos;analyse est ensuite 100 % locale, et rien ne
              quitte votre navigateur tant que vous ne rejoignez pas une
              organisation. La publication sur le Chrome Web Store arrive ; en
              attendant, l&apos;installation manuelle prend deux minutes.
            </p>
            <p className="text-sm text-muted">
              Compatible avec Chrome et les navigateurs Chromium (Edge, Brave,
              Arc) sur ordinateur. Pas de version iPhone, iPad ou Android à ce
              stade : les navigateurs mobiles n&apos;acceptent pas les
              extensions.
            </p>
          </div>

          <ol className="space-y-7">
            <Step n={1} title="Télécharger l'extension">
              <p>
                <a
                  href={DIRECT_ZIP}
                  download
                  className="inline-block rounded-lg bg-accent px-4 py-2 font-medium text-white transition hover:opacity-90"
                >
                  ⬇︎ Télécharger Prompt Tracker (v{VERSION}, zip)
                </a>
              </p>
              <p className="mt-2">
                Décompressez l&apos;archive (double-clic) : elle contient
                directement l&apos;extension (le dossier avec{" "}
                <code className="rounded bg-soft px-1.5 py-0.5 text-xs">
                  manifest.json
                </code>
                ). Gardez ce dossier : Chrome le lit en place, ne le supprimez
                pas après l&apos;installation.
              </p>
            </Step>

            <Step n={2} title="Activer le mode développeur de Chrome">
              <p>
                Ouvrez{" "}
                <code className="rounded bg-soft px-1.5 py-0.5 text-xs">
                  chrome://extensions
                </code>{" "}
                (copiez cette adresse dans la barre d&apos;URL) et activez le
                bouton « Mode développeur » en haut à droite.
              </p>
            </Step>

            <Step n={3} title="Charger l'extension">
              <p>
                Cliquez sur « Charger l&apos;extension non empaquetée » et
                sélectionnez le dossier décompressé à l&apos;étape 1. La page
                de bienvenue s&apos;ouvre : elle détaille les données
                enregistrées et leur usage, et l&apos;extension reste inactive
                tant que vous n&apos;avez pas cliqué « J&apos;accepte et
                j&apos;active ». Choisissez ensuite votre profil d&apos;usage,
                votre thème et votre niveau de friction. Épinglez l&apos;icône
                via le menu extensions (puzzle) pour garder les statistiques à
                portée de clic.
              </p>
            </Step>

            <Step n={4} title="Essayer">
              <p>
                Ouvrez ChatGPT, Claude, Gemini, Mistral ou Grok et tapez un prompt volontairement
                vague, par exemple « fais mes devoirs de maths ». L&apos;envoi
                est retenu et le dialogue socratique s&apos;ouvre. Vous décidez
                toujours : améliorer, envoyer tel quel, ou annuler.
              </p>
            </Step>

            <Step n={5} title="Synchroniser avec ce tableau de bord (optionnel)">
              <p>
                Sans compte, tout reste sur votre ordinateur. Pour retrouver
                votre progression ici, cliquez sur l&apos;icône de
                l&apos;extension, connectez-vous avec le même compte que sur
                ce site et rejoignez votre classe : l&apos;extension vous
                montre alors ce qui sera partagé (indicateurs et scores,
                jamais aucun texte sans votre consentement séparé, catégorie
                par catégorie) et attend votre confirmation. Conservation :
                contenus 90 jours, indicateurs 12 mois. Détails dans la{" "}
                <Link
                  href="/privacy"
                  className="font-medium text-accent hover:underline"
                >
                  politique de confidentialité
                </Link>
                .
              </p>
            </Step>
          </ol>

          <div className="rounded-2xl border border-card-border bg-card p-5 text-sm leading-relaxed text-muted shadow-card">
            <p>
              <span className="font-medium text-foreground">
                Mise à jour manuelle :
              </span>{" "}
              retéléchargez l&apos;archive, remplacez le dossier, puis cliquez
              sur l&apos;icône ↻ de la carte Prompt Tracker dans{" "}
              <code className="rounded bg-soft px-1.5 py-0.5 text-xs">
                chrome://extensions
              </code>
              . Dès la publication sur le Chrome Web Store, les mises à jour
              seront automatiques.
            </p>
          </div>
        </article>
      </main>
    </div>
  );
}
