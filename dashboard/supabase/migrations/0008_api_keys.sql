-- Clés API d'organisation (machine-to-machine pour le SI de l'école).
-- La clé en clair (pt_live_ + 32 aléatoires) n'est JAMAIS stockée : générée
-- côté serveur, affichée une seule fois, hash SHA-256 en base.

create table if not exists public.org_api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  key_prefix text not null,
  scopes text[] not null default array['events:read', 'progress:read'],
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists org_api_keys_org on public.org_api_keys (org_id);

alter table public.org_api_keys enable row level security;

drop policy if exists api_keys_admin on public.org_api_keys;
create policy api_keys_admin on public.org_api_keys for all
  using (public.auth_is_admin() and org_id = public.auth_org_id())
  with check (public.auth_is_admin() and org_id = public.auth_org_id());

-- Rate limiting à fenêtre fixe (60 s), un compteur par clé et par fenêtre.
-- Accès service_role uniquement (aucune policy : RLS bloque anon/authenticated).
create table if not exists public.api_rate_limits (
  key_id uuid not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key_id, window_start)
);
alter table public.api_rate_limits enable row level security;

create or replace function public.api_hit(p_key uuid, p_limit integer default 60)
  returns boolean language plpgsql security definer set search_path = public
as $$
declare c integer;
begin
  insert into public.api_rate_limits (key_id, window_start, count)
    values (p_key, date_trunc('minute', now()), 1)
  on conflict (key_id, window_start)
    do update set count = public.api_rate_limits.count + 1
  returning count into c;
  -- ménage opportuniste : purge des fenêtres de plus d'une heure
  delete from public.api_rate_limits where window_start < now() - interval '1 hour';
  return c <= p_limit;
end $$;
revoke execute on function public.api_hit(uuid, integer) from anon, authenticated;
