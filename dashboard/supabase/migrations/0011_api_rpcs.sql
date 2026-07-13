-- API d'organisation : toute l'autorisation vit ici, en SQL security definer.
-- Les routes Next.js /api/v1/* appellent ces RPC avec la clé anon : aucune
-- service_role key à déployer. Chaque RPC : vérifie le hash de la clé API,
-- le scope, le rate limit, et n'expose le CONTENU que si le consentement
-- COURANT de l'utilisateur est actif (la révocation coupe aussi l'historique).

-- Authentifie une clé, vérifie le scope, applique le rate limit.
create or replace function public.api_auth(p_key text, p_scope text)
  returns public.org_api_keys language plpgsql volatile security definer set search_path = public
as $$
declare k public.org_api_keys;
begin
  select * into k from public.org_api_keys
   where key_hash = encode(digest(coalesce(p_key, ''), 'sha256'), 'hex')
     and revoked_at is null;
  if not found then raise exception 'invalid_key'; end if;
  if not (p_scope = any (k.scopes)) then raise exception 'forbidden_scope'; end if;
  if not public.api_hit(k.id) then raise exception 'rate_limited'; end if;
  update public.org_api_keys set last_used_at = now()
   where id = k.id and (last_used_at is null or last_used_at < now() - interval '1 minute');
  return k;
end $$;
revoke execute on function public.api_auth(text, text) from anon, authenticated;

-- GET /api/v1/groups
create or replace function public.api_groups(p_key text)
  returns jsonb language plpgsql volatile security definer set search_path = public
as $$
declare k public.org_api_keys := public.api_auth(p_key, 'events:read');
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', g.id, 'name', g.name,
      'member_count', (select count(*) from group_members m where m.group_id = g.id)
    ) order by g.name)
    from groups g where g.org_id = k.org_id
  ), '[]'::jsonb);
end $$;

-- GET /api/v1/students
create or replace function public.api_students(p_key text, p_group uuid default null)
  returns jsonb language plpgsql volatile security definer set search_path = public
as $$
declare k public.org_api_keys := public.api_auth(p_key, 'events:read');
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'display_name', p.display_name,
      'email', p.email,
      'role', p.role,
      'disabled', p.disabled,
      'groups', (select coalesce(jsonb_agg(m.group_id), '[]'::jsonb)
                 from group_members m where m.user_id = p.id),
      'consents', (select coalesce(jsonb_object_agg(c.category, c.granted), '{}'::jsonb)
                   from consents c where c.user_id = p.id)
    ) order by p.email)
    from profiles p
    where p.org_id = k.org_id
      and (p_group is null or exists (
        select 1 from group_members m
        join groups g on g.id = m.group_id
        where m.user_id = p.id and m.group_id = p_group and g.org_id = k.org_id))
  ), '[]'::jsonb);
end $$;

-- GET /api/v1/events : pagination keyset (ts desc, id desc), contenu filtré
-- au consentement COURANT via effective_capture.
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

-- GET /api/v1/progress : agrégats hebdomadaires par étudiant. La North Star
-- (premiers jets) est calculable sans aucun contenu : disponible pour tous.
create or replace function public.api_progress(
  p_key text,
  p_group uuid default null,
  p_user uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null
) returns jsonb language plpgsql volatile security definer set search_path = public
as $$
declare k public.org_api_keys := public.api_auth(p_key, 'progress:read');
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', user_id, 'week', week, 'events', events,
      'avg_first_draft', round(avg_first::numeric, 1),
      'avg_after', round(avg_after::numeric, 1),
      'intercepted', intercepted,
      'improved', improved, 'sent_anyway', sent_anyway, 'cancelled', cancelled
    ) order by week, user_id)
    from (
      select
        e.user_id,
        to_char(date_trunc('week', e.ts), 'YYYY-MM-DD') as week,
        count(*) as events,
        avg(coalesce(e.score_before, (e.scores ->> 'total')::numeric)) as avg_first,
        avg((e.scores ->> 'total')::numeric) as avg_after,
        count(*) filter (where e.intercepted) as intercepted,
        count(*) filter (where e.outcome = 'improved') as improved,
        count(*) filter (where e.outcome = 'sent_anyway') as sent_anyway,
        count(*) filter (where e.outcome = 'cancelled') as cancelled
      from prompt_events e
      where e.org_id = k.org_id
        and (p_user is null or e.user_id = p_user)
        and (p_from is null or e.ts >= p_from)
        and (p_to is null or e.ts < p_to)
        and (p_group is null or exists (
          select 1 from group_members m where m.user_id = e.user_id and m.group_id = p_group))
      group by e.user_id, date_trunc('week', e.ts)
    ) agg
  ), '[]'::jsonb);
end $$;

-- Les RPC api_* sont appelées par les routes Next avec la clé anon : la
-- sécurité est portée par la clé API passée en argument, pas par le rôle.
grant execute on function public.api_groups(text) to anon;
grant execute on function public.api_students(text, uuid) to anon;
grant execute on function public.api_events(text, timestamptz, timestamptz, uuid, uuid, timestamptz, uuid, integer) to anon;
grant execute on function public.api_progress(text, uuid, uuid, timestamptz, timestamptz) to anon;
