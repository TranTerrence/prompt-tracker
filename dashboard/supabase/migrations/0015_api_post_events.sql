-- API v1 : exposition des réflexions du miroir d'après (post_events).
-- Même architecture que 0011 : RPC security definer appelée par la route
-- Next avec la clé anon ; auth par hash de clé API (api_auth : scope +
-- rate limit), pagination keyset (ts desc, id desc), et CONTENU filtré au
-- consentement COURANT via effective_capture (la révocation coupe aussi
-- l'accès à l'historique déjà stocké).

-- GET /api/v1/post-events
create or replace function public.api_post_events(
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
        'ts', e.ts, 'site', e.site, 'post_key', e.post_key,
        'category', e.category, 'answered', e.answered,
        'answer_words', e.answer_words,
        'answer', case when public.effective_capture(e.org_id, e.user_id, 'post_reflection') then e.answer end,
        'conv_key', case when public.effective_capture(e.org_id, e.user_id, 'conversation_history') then e.conv_key end
      ) as row_data
    from post_events e
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

-- Verrouillage des grants (même discipline que 0013) : revoke du grant
-- PUBLIC implicite, puis audience explicite. La RPC est appelée par les
-- routes Next avec la clé anon : la sécurité est portée par la clé API
-- passée en argument, pas par le rôle.
revoke execute on function public.api_post_events(text, timestamptz, timestamptz, uuid, uuid, timestamptz, uuid, integer) from public;
grant execute on function public.api_post_events(text, timestamptz, timestamptz, uuid, uuid, timestamptz, uuid, integer) to anon;
