import type { Metadata } from "next";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Politique de confidentialité : Prompt Tracker",
  description:
    "Politique de confidentialité de Prompt Tracker : analyse locale des prompts, synchronisation limitée aux métadonnées, hébergement en Union européenne.",
};

const LAST_UPDATE = "16 juillet 2026";
const LAST_UPDATE_EN = "July 16, 2026";

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

          <Section title="1. Responsable du traitement et champ d'application">
            <p className="leading-relaxed text-muted">
              Prompt Tracker est édité par Terrence Tran (contact :{" "}
              <a
                href="mailto:terrence.tran0@gmail.com"
                className="font-medium text-accent hover:underline"
              >
                terrence.tran0@gmail.com
              </a>
              ). Cette politique couvre l&apos;extension de navigateur Prompt
              Tracker et le tableau de bord associé (track-prompt.vercel.app).
            </p>
          </Section>

          <Section title="2. Fonctionnement 100 % local par défaut">
            <p className="leading-relaxed text-muted">
              L&apos;extension ne s&apos;active qu&apos;après votre acceptation
              explicite de l&apos;écran de divulgation affiché au premier
              lancement. Avant cet accord, elle n&apos;enregistre rien, même
              localement. Après votre accord, elle enregistre{" "}
              <strong className="text-foreground">
                sur votre ordinateur uniquement
              </strong>{" "}
              (stockage local du navigateur), pour chaque prompt sur ChatGPT,
              Claude, Gemini, Mistral et Grok :
            </p>
            <ul className="list-disc space-y-1.5 pl-5 leading-relaxed text-muted">
              <li>scores de qualité (clarté, contexte, itération, critique) ;</li>
              <li>catégorie du prompt, nombre de mots, site utilisé, date ;</li>
              <li>issue (envoyé, amélioré, annulé) et tours de réflexion ;</li>
              <li>vos réponses au dialogue socratique et vos réflexions d&apos;après-réponse ;</li>
              <li>
                le texte complet de vos prompts, uniquement si vous activez
                l&apos;option dédiée dans les réglages.
              </li>
            </ul>
            <p className="leading-relaxed text-muted">
              Sans compte, aucune de ces données ne quitte votre machine. Vous
              pouvez les exporter (CSV) ou les effacer à tout moment depuis le
              popup de l&apos;extension.
            </p>
          </Section>

          <Section title="3. Données de compte">
            <p className="leading-relaxed text-muted">
              Si vous créez un compte (optionnel), nous collectons votre{" "}
              <strong className="text-foreground">adresse email</strong> et un
              mot de passe (stocké haché, jamais en clair). Ils servent
              exclusivement à l&apos;authentification et à votre identification
              auprès de votre organisation (votre enseignant voit votre email).
            </p>
          </Section>

          <Section title="4. Indicateurs partagés avec votre organisation">
            <p className="leading-relaxed text-muted">
              Rejoindre une classe est un acte explicite : l&apos;extension
              affiche ce qui sera partagé et vous le confirmez d&apos;un
              bouton. À partir de là, elle synchronise vers le tableau de bord
              de votre organisation les{" "}
              <strong className="text-foreground">indicateurs</strong> suivants
              : scores de qualité, catégories de prompts, nombres de mots,
              sites utilisés, issues (envoyé, amélioré, annulé) et dates.
              Jamais aucun contenu. Ces indicateurs sont visibles par les
              enseignants et administrateurs de votre organisation, dans le
              seul but d&apos;un accompagnement pédagogique.
            </p>
          </Section>

          <Section title="5. Contenus soumis à votre consentement">
            <p className="leading-relaxed text-muted">
              Quatre catégories de contenu ne sont partagées que si votre
              organisation les demande (avec un motif affiché){" "}
              <strong className="text-foreground">et</strong> que vous y
              consentez, catégorie par catégorie, depuis l&apos;écran « Mes
              données partagées » :
            </p>
            <ul className="list-disc space-y-1.5 pl-5 leading-relaxed text-muted">
              <li>le texte de vos prompts ;</li>
              <li>vos réponses au dialogue socratique ;</li>
              <li>vos réflexions d&apos;après-réponse ;</li>
              <li>le regroupement de vos prompts par conversation.</li>
            </ul>
            <p className="leading-relaxed text-muted">
              Les interrupteurs sont désactivés par défaut et révocables à tout
              moment. Un déclencheur côté serveur efface systématiquement tout
              contenu non consenti dès sa réception : il n&apos;est ni stocké
              ni consultable. Un bouton « Effacer le contenu déjà partagé »
              supprime immédiatement les contenus, en conservant vos
              indicateurs.
            </p>
          </Section>

          <Section title="6. Questions générées par IA (option)">
            <p className="leading-relaxed text-muted">
              Si votre organisation active les questions socratiques sur
              mesure, et uniquement si vous avez consenti au partage du texte
              de vos prompts et de votre raisonnement socratique, votre prompt
              et le dialogue en cours transitent par notre serveur puis par
              Anthropic (fournisseur d&apos;IA) pour générer la question
              suivante. Ces données transitent sans être stockées, ni par notre
              serveur, ni par Anthropic. Sans ces consentements, les questions
              proviennent d&apos;une banque locale intégrée à l&apos;extension.
            </p>
          </Section>

          <Section title="7. Durées de conservation">
            <ul className="list-disc space-y-1.5 pl-5 leading-relaxed text-muted">
              <li>
                <strong className="text-foreground">Contenus partagés</strong>{" "}
                (textes, dialogues, réflexions, fils de conversation) : effacés
                automatiquement au bout de{" "}
                <strong className="text-foreground">90 jours</strong> ;
              </li>
              <li>
                <strong className="text-foreground">Indicateurs</strong>{" "}
                (scores, catégories, compteurs) : supprimés automatiquement au
                bout de <strong className="text-foreground">12 mois</strong> ;
              </li>
              <li>
                la suppression de votre compte entraîne la suppression en
                cascade de toutes vos données ;
              </li>
              <li>
                vous pouvez effacer les contenus déjà partagés à tout moment,
                sans attendre ces échéances.
              </li>
            </ul>
          </Section>

          <Section title="8. Hébergement et sous-traitants">
            <p className="leading-relaxed text-muted">
              Les données synchronisées sont hébergées par Supabase dans
              l&apos;Union européenne (région Paris, France). Le tableau de
              bord est servi par Vercel. Anthropic n&apos;intervient que pour
              l&apos;option décrite à la section 6, en transit et sans
              conservation. Vos données ne sont ni vendues, ni partagées avec
              d&apos;autres tiers, ni utilisées à des fins publicitaires, ni
              utilisées pour entraîner des modèles d&apos;IA.
            </p>
          </Section>

          <Section title="9. Vos droits (RGPD)">
            <p className="leading-relaxed text-muted">
              Conformément au Règlement général sur la protection des données,
              vous disposez d&apos;un droit d&apos;accès, de rectification,
              d&apos;effacement et de portabilité (export CSV intégré à
              l&apos;extension). Vous pouvez exercer ces droits directement
              dans l&apos;extension (effacement local, purge du contenu
              partagé) ou en écrivant à{" "}
              <a
                href="mailto:terrence.tran0@gmail.com"
                className="font-medium text-accent hover:underline"
              >
                terrence.tran0@gmail.com
              </a>
              .
            </p>
          </Section>

          <Section title="10. Modifications de cette politique">
            <p className="leading-relaxed text-muted">
              Toute évolution de cette politique sera publiée sur cette page
              avec sa date de mise à jour. Si un changement élargit les données
              collectées, l&apos;extension vous le présentera et demandera à
              nouveau votre accord avant de l&apos;appliquer.
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
              Last updated: {LAST_UPDATE_EN}
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

          <Section title="1. Data controller and scope">
            <p className="leading-relaxed text-muted">
              Prompt Tracker is published by Terrence Tran (contact:{" "}
              <a
                href="mailto:terrence.tran0@gmail.com"
                className="font-medium text-accent hover:underline"
              >
                terrence.tran0@gmail.com
              </a>
              ). This policy covers the Prompt Tracker browser extension and
              its companion dashboard (track-prompt.vercel.app).
            </p>
          </Section>

          <Section title="2. 100% local by default">
            <p className="leading-relaxed text-muted">
              The extension only activates after you explicitly accept the
              disclosure screen shown on first launch. Before that consent, it
              records nothing, not even locally. After your consent, it records{" "}
              <strong className="text-foreground">
                on your computer only
              </strong>{" "}
              (browser local storage), for each prompt on ChatGPT, Claude,
              Gemini, Mistral and Grok:
            </p>
            <ul className="list-disc space-y-1.5 pl-5 leading-relaxed text-muted">
              <li>quality scores (clarity, context, iteration, critique);</li>
              <li>prompt category, word count, site used, date;</li>
              <li>outcome (sent, improved, cancelled) and reflection rounds;</li>
              <li>your answers to the Socratic dialogue and your post-response reflections;</li>
              <li>
                the full text of your prompts, only if you enable the dedicated
                setting.
              </li>
            </ul>
            <p className="leading-relaxed text-muted">
              Without an account, none of this data leaves your machine. You
              can export it (CSV) or erase it at any time from the extension
              popup.
            </p>
          </Section>

          <Section title="3. Account data">
            <p className="leading-relaxed text-muted">
              If you create an account (optional), we collect your{" "}
              <strong className="text-foreground">email address</strong> and a
              password (stored hashed, never in clear text). They are used
              exclusively for authentication and to identify you to your
              organization (your teacher sees your email).
            </p>
          </Section>

          <Section title="4. Indicators shared with your organization">
            <p className="leading-relaxed text-muted">
              Joining a class is an explicit act: the extension shows what will
              be shared and you confirm it with a button. From then on, it
              syncs the following{" "}
              <strong className="text-foreground">indicators</strong> to your
              organization&apos;s dashboard: quality scores, prompt categories,
              word counts, sites used, outcomes (sent, improved, cancelled) and
              dates. Never any content. These indicators are visible to your
              organization&apos;s teachers and administrators, for the sole
              purpose of pedagogical support.
            </p>
          </Section>

          <Section title="5. Content subject to your consent">
            <p className="leading-relaxed text-muted">
              Four content categories are shared only if your organization
              requests them (with a stated purpose){" "}
              <strong className="text-foreground">and</strong> you consent,
              category by category, from the &ldquo;My shared data&rdquo;
              screen:
            </p>
            <ul className="list-disc space-y-1.5 pl-5 leading-relaxed text-muted">
              <li>the text of your prompts;</li>
              <li>your answers to the Socratic dialogue;</li>
              <li>your post-response reflections;</li>
              <li>the grouping of your prompts by conversation.</li>
            </ul>
            <p className="leading-relaxed text-muted">
              Toggles are off by default and revocable at any time. A
              server-side trigger systematically erases any non-consented
              content upon receipt: it is neither stored nor accessible. An
              &ldquo;Erase already shared content&rdquo; button immediately
              deletes content while keeping your indicators.
            </p>
          </Section>

          <Section title="6. AI-generated questions (optional)">
            <p className="leading-relaxed text-muted">
              If your organization enables tailored Socratic questions, and
              only if you have consented to sharing your prompt text and your
              Socratic reasoning, your prompt and the ongoing dialogue transit
              through our server and then Anthropic (AI provider) to generate
              the next question. This data transits without being stored, by
              our server or by Anthropic. Without those consents, questions
              come from a local bank built into the extension.
            </p>
          </Section>

          <Section title="7. Retention periods">
            <ul className="list-disc space-y-1.5 pl-5 leading-relaxed text-muted">
              <li>
                <strong className="text-foreground">Shared content</strong>{" "}
                (texts, dialogues, reflections, conversation threads):
                automatically erased after{" "}
                <strong className="text-foreground">90 days</strong>;
              </li>
              <li>
                <strong className="text-foreground">Indicators</strong>{" "}
                (scores, categories, counters): automatically deleted after{" "}
                <strong className="text-foreground">12 months</strong>;
              </li>
              <li>
                deleting your account cascades to all your data;
              </li>
              <li>
                you can erase already shared content at any time, without
                waiting for these deadlines.
              </li>
            </ul>
          </Section>

          <Section title="8. Hosting and sub-processors">
            <p className="leading-relaxed text-muted">
              Synced data is hosted by Supabase in the European Union (Paris
              region, France). The dashboard is served by Vercel. Anthropic is
              only involved in the option described in section 6, in transit
              and without retention. Your data is never sold, shared with any
              other third party, used for advertising, or used to train AI
              models.
            </p>
          </Section>

          <Section title="9. Your rights (GDPR)">
            <p className="leading-relaxed text-muted">
              Under the General Data Protection Regulation, you have the right
              to access, rectify, erase, and port your data (CSV export built
              into the extension). You can exercise these rights directly in
              the extension (local erase, shared-content purge) or by writing
              to{" "}
              <a
                href="mailto:terrence.tran0@gmail.com"
                className="font-medium text-accent hover:underline"
              >
                terrence.tran0@gmail.com
              </a>
              .
            </p>
          </Section>

          <Section title="10. Changes to this policy">
            <p className="leading-relaxed text-muted">
              Any change to this policy will be published on this page with its
              update date. If a change broadens the data collected, the
              extension will present it to you and ask for your consent again
              before applying it.
            </p>
          </Section>
        </article>
      </main>

      <footer className="border-t border-card-border">
        <div className="mx-auto max-w-3xl space-y-2 px-6 py-6 text-center text-xs text-muted">
          <p>
            <Link href="/methode" className="font-medium text-accent hover:underline">
              Comment le score et les modes sont calculés
            </Link>
          </p>
          <p>Prompt Tracker : Le garde-fou de votre prompting</p>
        </div>
      </footer>
    </div>
  );
}
