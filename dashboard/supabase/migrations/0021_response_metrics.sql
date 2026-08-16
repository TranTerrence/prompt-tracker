-- Mesures post-réponse (v0.7.0 de l'extension).
--
-- CE SONT DES INDICATEURS, PAS DU CONTENU. Le texte de la réponse de l'IA
-- n'est jamais lu au-delà d'un comptage de caractères et de mots, jamais
-- transmis, jamais stocké : la promesse « jamais aucun contenu » de la
-- politique de confidentialité reste entière.
--
-- Conséquences volontaires :
--   * rétention 12 mois comme les scores, PAS 90 jours — ces colonnes ne sont
--     donc PAS ajoutées à apply_retention() (0014) ;
--   * pas touchées par purge_my_content() (0009), qui n'efface que du contenu ;
--   * pas de nouvelle catégorie de consentement, donc rien à ajouter à
--     enforce_consent() (0005) — le socle de divulgation les couvre.
--
-- Aucune modification de api_events (0011) : la RPC publique construit un
-- jsonb_build_object explicite, ces colonnes n'entrent donc pas dans l'API v1.

alter table public.prompt_events
  add column if not exists prompt_chars integer,
  add column if not exists model text,
  add column if not exists model_catalog_version integer,
  add column if not exists response_chars integer,
  add column if not exists response_words integer,
  add column if not exists latency_ms integer,
  add column if not exists response_ms integer,
  add column if not exists turn_index integer,
  add column if not exists read_ms integer,
  add column if not exists response_outcome text;

comment on column public.prompt_events.model is
  'Identifiant NORMALISÉ contre une liste blanche côté extension (CoachModels). '
  'Jamais le libellé lu dans la page : un GPT personnalisé porte un nom écrit '
  'par un utilisateur. "autre" = libellé lu mais hors catalogue ; null = non '
  'mesurable. Se lit avec model_catalog_version.';
comment on column public.prompt_events.latency_ms is
  'Temps jusqu''au premier token VISIBLE (rendu DOM), pas la latence du modèle. '
  'Null si l''onglet est passé en arrière-plan ou si le site n''a pas de '
  'sélecteur de réponse. Non comparable entre sites.';
comment on column public.prompt_events.response_ms is
  'Durée de génération : dernière activité moins premier token. Approximative '
  'à ±1 s (le nœud continue de muter après la fin : boutons, coloration '
  'syntaxique). Non comparable entre sites.';
comment on column public.prompt_events.response_chars is
  'Sous-compte fortement quand la sortie part dans un panneau latéral '
  '(ChatGPT Canvas, Claude Artifacts) : le gros du texte est hors du nœud de '
  'message. Limite connue et assumée.';
comment on column public.prompt_events.read_ms is
  'Délai entre la fin d''une réponse et l''envoi du prompt suivant dans le '
  'MÊME fil. Signal de sur-dépendance. Aucun sélecteur de site requis : '
  'c''est la plus fiable des mesures de temps.';

do $$ begin
  alter table public.prompt_events
    add constraint prompt_events_response_outcome_check check (
      response_outcome is null
      or response_outcome in ('complete', 'timeout', 'hidden', 'abandoned', 'not_sent')),
    -- Défense en profondeur, dans l'esprit d'enforce_consent : un identifiant
    -- de modèle est un slug, jamais une phrase. Un nom de GPT personnalisé
    -- (« Assistant thèse de Marie ») ne passe pas ce filtre. La liste blanche
    -- côté extension reste la vraie garantie ; ceci est le filet.
    add constraint prompt_events_model_slug check (
      model is null or model ~ '^[a-z0-9][a-z0-9._-]{0,39}$'),
    -- Bornes de vraisemblance : un saut d'horloge (correction NTP) ou un
    -- onglet gelé ne doit pas empoisonner les moyennes.
    add constraint prompt_events_latency_range check (
      latency_ms is null or latency_ms between 0 and 600000),
    add constraint prompt_events_response_ms_range check (
      response_ms is null or response_ms between 0 and 3600000),
    add constraint prompt_events_read_ms_range check (
      read_ms is null or read_ms between 0 and 1800000),
    add constraint prompt_events_sizes_positive check (
      (prompt_chars is null or prompt_chars >= 0)
      and (response_chars is null or response_chars >= 0)
      and (response_words is null or response_words >= 0)
      and (turn_index is null or turn_index >= 0));
exception when duplicate_object then null; end $$;

-- Suivi de couverture : « quelle part des envois produit réellement une
-- mesure ? » est la question qui détecte un changement d'UI côté éditeur.
-- L'index sert les tableaux de bord établissement (agrégats par site/semaine).
create index if not exists prompt_events_org_site_ts_idx
  on public.prompt_events (org_id, site, ts desc);
