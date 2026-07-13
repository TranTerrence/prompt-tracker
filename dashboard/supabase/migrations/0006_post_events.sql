-- Réflexions du miroir d'après (explain-back, lecture latérale, désaccord).
-- Les indicateurs (answered, answer_words) relèvent du socle toujours
-- synchronisé ; le TEXTE de la réponse relève du consentement post_reflection,
-- la clé de conversation du consentement conversation_history.

create table if not exists public.post_events (
  id uuid primary key default gen_random_uuid(),
  client_event_id text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  ts timestamptz not null,
  site text not null,
  conv_key text,
  post_key text not null,
  category text,
  answered boolean not null default false,
  answer_words integer,
  answer text,
  created_at timestamptz not null default now(),
  unique (user_id, client_event_id)
);

create index if not exists post_events_org_ts on public.post_events (org_id, ts desc);
create index if not exists post_events_user_ts on public.post_events (user_id, ts desc);

create or replace function public.enforce_consent_post()
  returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if not public.effective_capture(new.org_id, new.user_id, 'post_reflection') then
    new.answer := null;
  end if;
  if not public.effective_capture(new.org_id, new.user_id, 'conversation_history') then
    new.conv_key := null;
  end if;
  return new;
end $$;
revoke execute on function public.enforce_consent_post() from anon, authenticated;

drop trigger if exists enforce_consent_post on public.post_events;
create trigger enforce_consent_post before insert on public.post_events
  for each row execute function public.enforce_consent_post();

alter table public.post_events enable row level security;

drop policy if exists post_events_insert on public.post_events;
create policy post_events_insert on public.post_events for insert
  with check (user_id = auth.uid() and org_id = public.auth_org_id());

drop policy if exists post_events_select on public.post_events;
create policy post_events_select on public.post_events for select
  using (user_id = auth.uid()
    or (public.auth_is_admin() and org_id = public.auth_org_id()));
