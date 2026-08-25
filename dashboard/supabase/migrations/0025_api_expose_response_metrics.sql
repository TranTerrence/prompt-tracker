-- L'API v1 expose les mesures post-réponse (retour sur la décision de 0021).
--
-- 0021 avait choisi de ne pas toucher api_events : « ces colonnes n'entrent
-- donc pas dans l'API v1 ». Depuis, un consommateur réel (le companion I-BE³)
-- veut construire un tableau « modèles utilisés » et des indicateurs de
-- sur-confiance (read_ms) — impossibles tant que ces colonnes s'arrêtent à la
-- frontière de l'API.
--
-- Ce qui rend l'exposition sûre, et pourquoi elle ne passe par aucune porte de
-- consentement : 0021 a classé ces colonnes INDICATEURS, PAS CONTENU. Aucun
-- texte, aucun extrait, uniquement des comptages, des durées et un slug de
-- modèle normalisé par liste blanche. Le contrat d'intégration promet une
-- évolution additive : huit clés de plus dans chaque événement, aucune clé
-- existante ne change, un consommateur qui les ignore ne voit rien.
--
-- mirror_feedback reste volontairement hors de l'API : c'est du texte libre,
-- donc du contenu — l'exposer exigerait d'abord une catégorie de consentement.
--
-- prompt_chars / response_chars restent aussi dehors (words suffit aux
-- consommateurs, les caractères sont un détail d'implémentation du comptage).

create or replace function public.api_events(
  p_key text,
  p_since timestamptz default null,
  p_until timestamptz default null,
  p_group uuid default null,
  p_user uuid default null,
  p_cursor_ts timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 100
) returns jsonb language plpgsql volatile security definer set search_path = public
as $$
declare
  k public.org_api_keys := public.api_auth(p_key, 'events:read');
  lim integer := least(greatest(coalesce(p_limit, 100), 1), 500);
  rows jsonb;
  last_ts timestamptz;
  last_id uuid;
begin
  select jsonb_agg(row_data order by rn),
         max(r_ts) filter (where rn = cnt),
         (max(r_id::text) filter (where rn = cnt))::uuid
    into rows, last_ts, last_id
  from (
    select
      e.ts as r_ts, e.id as r_id,
      row_number() over (order by e.ts desc, e.id desc) as rn,
      count(*) over () as cnt,
      jsonb_build_object(
        'id', e.id, 'client_event_id', e.client_event_id, 'user_id', e.user_id,
        'ts', e.ts, 'site', e.site, 'category', e.category, 'words', e.words,
        'scores', e.scores, 'intercepted', e.intercepted, 'outcome', e.outcome,
        'score_before', e.score_before, 'score_after', e.score_after,
        'mirror_shown', e.mirror_shown, 'rounds', e.rounds, 'answers_count', e.answers_count,
        -- Les mesures post-réponse de 0021 : indicateurs, jamais de contenu.
        'model', e.model, 'model_catalog_version', e.model_catalog_version,
        'response_words', e.response_words, 'latency_ms', e.latency_ms,
        'response_ms', e.response_ms, 'read_ms', e.read_ms,
        'turn_index', e.turn_index, 'response_outcome', e.response_outcome,
        'text', case when public.effective_capture(e.org_id, e.user_id, 'prompt_text') then e.text end,
        'dialogue', case when public.effective_capture(e.org_id, e.user_id, 'socratic_dialogue') then e.dialogue end,
        'conv_key', case when public.effective_capture(e.org_id, e.user_id, 'conversation_history') then e.conv_key end
      ) as row_data
    from prompt_events e
    where e.org_id = k.org_id
      and (p_since is null or e.ts >= p_since)
      and (p_until is null or e.ts < p_until)
      and (p_user is null or e.user_id = p_user)
      and (p_group is null or exists (
        select 1 from group_members m where m.user_id = e.user_id and m.group_id = p_group))
      and (p_cursor_ts is null or (e.ts, e.id) < (p_cursor_ts, p_cursor_id))
    order by e.ts desc, e.id desc
    limit lim
  ) q;

  return jsonb_build_object(
    'data', coalesce(rows, '[]'::jsonb),
    'next_cursor', case
      when rows is not null and jsonb_array_length(rows) = lim
      then jsonb_build_object('ts', last_ts, 'id', last_id)
    end
  );
end $$;

-- `create or replace` réattribue le grant implicite de Supabase (leçon de
-- 0013/0016/0023) : on réaffirme la posture de 0011 — anon seul, la sécurité
-- est portée par la clé API passée en argument.
revoke execute on function public.api_events(text, timestamptz, timestamptz, uuid, uuid, timestamptz, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.api_events(text, timestamptz, timestamptz, uuid, uuid, timestamptz, uuid, integer) to anon;
