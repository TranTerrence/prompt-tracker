import type { Metadata } from "next";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "La méthode : comment le score est calculé : Prompt Tracker",
  description:
    "Le barème de Prompt Tracker expliqué : quatre rubriques sur 25, seuil d'interception, règles anti-contournement, modes automatiques. Une définition faite pour être discutée.",
};

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

function Rubrique({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-card-border bg-card p-5 shadow-card">
      <h3 className="font-display text-base font-semibold">{name}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{children}</p>
    </div>
  );
}

export default function MethodePage() {
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
              La méthode : score, seuil, modes
            </h1>
            <p className="text-muted">
              Chaque prompt est évalué localement, dans le navigateur, par un
              barème ouvert et versionné. Le score n&apos;est pas une note :
              c&apos;est un miroir, conçu pour déclencher une pause réfléchie
              quand la demande gagnerait à être travaillée. Cette page rend le
              barème discutable : si un prompt vous semble mal évalué,
              envoyez-le nous, c&apos;est exactement comme ça qu&apos;il
              s&apos;améliore.
            </p>
          </div>

          <Section title="Un score sur 100, quatre rubriques sur 25">
            <p className="text-sm leading-relaxed text-muted">
              Le barème additionne des indices observables dans le texte du
              prompt. Il n&apos;appelle aucun serveur : la version 2 du barème
              est un module local, le même pour tout le monde.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Rubrique name="Clarté (25)">
                Une demande construite : assez de vocabulaire pour être
                comprise sans deviner (les répétitions ne comptent pas), un
                verbe d&apos;action (« analyse », « compare », « corrige ») et
                une phrase terminée.
              </Rubrique>
              <Rubrique name="Contexte (25)">
                Ce que l&apos;IA ne peut pas inventer : le rôle ou
                l&apos;audience, les contraintes (longueur, échéance, format),
                et surtout de la matière à travailler : un extrait cité, un
                plan, du code, un brouillon.
              </Rubrique>
              <Rubrique name="Itération (25)">
                S&apos;appuyer sur l&apos;échange : reprendre la réponse
                précédente, préciser, affiner, plutôt que repartir de zéro.
                L&apos;usage réel de l&apos;IA est un affinage en plusieurs
                tours ; cette rubrique le récompense explicitement.
              </Rubrique>
              <Rubrique name="Esprit critique (25)">
                Garder la main : demander les sources ou les preuves, annoncer
                ce qu&apos;on vérifiera, demander les limites ou les
                contre-arguments de la réponse.
              </Rubrique>
            </div>
          </Section>

          <Section title="Un exemple réel, calculé par le moteur">
            <div className="overflow-x-auto rounded-2xl border border-card-border bg-card shadow-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted">
                    <th className="px-5 py-3 font-medium">Prompt</th>
                    <th className="px-5 py-3 font-medium">Clarté</th>
                    <th className="px-5 py-3 font-medium">Contexte</th>
                    <th className="px-5 py-3 font-medium">Critique</th>
                    <th className="px-5 py-3 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-card-border">
                    <td className="px-5 py-3 text-muted">
                      « fais ma dissertation sur Candide pour demain »
                    </td>
                    <td className="px-5 py-3 tabular-nums">7</td>
                    <td className="px-5 py-3 tabular-nums">0</td>
                    <td className="px-5 py-3 tabular-nums">0</td>
                    <td className="px-5 py-3 font-semibold tabular-nums">
                      7/100
                    </td>
                  </tr>
                  <tr className="border-t border-card-border">
                    <td className="px-5 py-3 text-muted">
                      Le même devoir, avec le cours, l&apos;échéance, le plan,
                      la thèse citée, une demande de contre-arguments et une
                      vérification annoncée
                    </td>
                    <td className="px-5 py-3 tabular-nums">25</td>
                    <td className="px-5 py-3 tabular-nums">25</td>
                    <td className="px-5 py-3 tabular-nums">20</td>
                    <td className="px-5 py-3 font-semibold tabular-nums">
                      70/100
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted">
              Scores calculés par le barème v2 sur ces textes exacts. La
              rubrique itération vaut 0 sur un premier message : elle se gagne
              dans la suite de l&apos;échange.
            </p>
          </Section>

          <Section title="Ce que le score n'achète pas">
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted">
              <li>
                <span className="font-medium text-foreground">
                  Empiler des mots-clés ne paie pas.
                </span>{" "}
                Les bonus de longueur comptent les mots uniques, pas les
                répétitions.
              </li>
              <li>
                <span className="font-medium text-foreground">
                  Déléguer sans matière est plafonné.
                </span>{" "}
                « Fais mes devoirs » entouré de vocabulaire bien choisi reste
                une délégation : sans extrait, tentative ou brouillon fourni,
                les rubriques contexte et critique sont plafonnées.
              </li>
              <li>
                <span className="font-medium text-foreground">
                  L&apos;échafaudage ne se score pas lui-même.
                </span>{" "}
                Quand le dialogue compile vos réponses en un prompt structuré,
                le score affiché mesure votre réflexion, pas la structure
                ajoutée par l&apos;outil.
              </li>
            </ul>
          </Section>

          <Section title="Le seuil et la cadence d'interception">
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted">
              <li>
                Sous le seuil (40/100 par défaut ; votre organisation peut le
                régler), l&apos;envoi est retenu et le dialogue s&apos;ouvre.
                Vous décidez toujours de l&apos;issue : améliorer, envoyer tel
                quel, annuler.
              </li>
              <li>
                L&apos;interception ne vise que l&apos;OUVERTURE d&apos;un
                sujet. Les suites d&apos;une conversation ne sont jamais
                interceptées ; le coach ne revient dans un fil lancé
                qu&apos;après trois décrochages nets consécutifs, et « Laisse-moi
                sur ce fil » le fait taire pour de bon.
              </li>
              <li>
                Le seuil monte doucement avec vos séries de bons premiers
                jets : plus vous progressez, plus l&apos;outil s&apos;efface.
              </li>
            </ul>
          </Section>

          <Section title="Les modes : qui catégorise ?">
            <p className="text-sm leading-relaxed text-muted">
              Personne ne choisit un mode, ni l&apos;étudiant ni
              l&apos;enseignant : la catégorie est entièrement déterminée par
              ce qui s&apos;est passé au moment de l&apos;envoi.
            </p>
            <div className="overflow-x-auto rounded-2xl border border-card-border bg-card shadow-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted">
                    <th className="px-5 py-3 font-medium">Ce qui s&apos;est passé</th>
                    <th className="px-5 py-3 font-medium">Catégorie</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-card-border">
                    <td className="px-5 py-3 text-muted">
                      Intercepté, a travaillé avec le dialogue, a envoyé la
                      version enrichie
                    </td>
                    <td className="px-5 py-3">Avec accompagnement</td>
                  </tr>
                  <tr className="border-t border-card-border">
                    <td className="px-5 py-3 text-muted">
                      Non intercepté : le premier jet passait le seuil
                    </td>
                    <td className="px-5 py-3">Direct (bon premier jet)</td>
                  </tr>
                  <tr className="border-t border-card-border">
                    <td className="px-5 py-3 text-muted">
                      Intercepté, a décliné l&apos;aide, a envoyé tel quel
                    </td>
                    <td className="px-5 py-3">Direct (aide déclinée)</td>
                  </tr>
                  <tr className="border-t border-card-border">
                    <td className="px-5 py-3 text-muted">
                      Intercepté, n&apos;a finalement rien envoyé
                    </td>
                    <td className="px-5 py-3">Annulé</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-sm leading-relaxed text-muted">
              Un étudiant déjà autonome qui écrit un prompt riche sort en
              « direct » : c&apos;est un succès, pas un défaut
              d&apos;accompagnement. C&apos;est pourquoi la mesure qui compte
              n&apos;est pas le mode mais le PREMIER JET : le score de ce que
              l&apos;étudiant produit seul, avant toute aide. C&apos;est la
              courbe mise en avant dans les tableaux de bord.
            </p>
          </Section>

          <Section title="Versionné, mesuré, discutable">
            <p className="text-sm leading-relaxed text-muted">
              Le barème est versionné (v2 actuellement) : chaque événement
              enregistre la version qui l&apos;a scoré, pour que les courbes de
              progression restent comparables quand le barème évolue. La v2 est
              validée par un banc de 40 prompts étiquetés (faibles contre
              forts) : 42 points d&apos;écart moyen entre les deux groupes,
              aucun faux positif ni faux négatif au seuil de 40. Le code du
              barème est public dans le dépôt du projet.
            </p>
            <p className="text-sm leading-relaxed text-muted">
              Qu&apos;est-ce qu&apos;un bon prompt, fondamentalement ? Cette
              page est notre réponse actuelle, pas la réponse définitive. Si
              une question du dialogue vous semble trop légère, si un prompt
              vous paraît mal scoré : envoyez l&apos;exemple à votre référent
              Prompt Tracker, il rejoindra le banc de test.
            </p>
          </Section>

          <div className="flex flex-wrap gap-4 border-t border-card-border pt-6 text-sm">
            <Link href="/privacy" className="font-medium text-accent hover:underline">
              Politique de confidentialité
            </Link>
            <Link href="/install" className="font-medium text-accent hover:underline">
              Installer l&apos;extension
            </Link>
          </div>
        </article>
      </main>
    </div>
  );
}
