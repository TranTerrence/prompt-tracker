-- Appairage extension ↔ web par device-code (RFC 8628 inversé).
--
-- Problème résolu : l'élève devait saisir son mot de passe une deuxième fois,
-- dans le popup, après l'avoir déjà saisi sur le web. Deux sessions sans
-- rapport, aucune passerelle, et un champ mot de passe dans un popup
-- d'extension — ce qu'on préfère éviter en revue de store.
--
-- Pourquoi PAS externally_connectable : la distribution actuelle est le zip
-- non empaqueté, donc l'ID d'extension est dérivé du chemin du dossier et
-- diffère sur chaque machine. `chrome.runtime.sendMessage(EXT_ID, …)` depuis
-- le dashboard exige un ID connu à l'avance ; il faudrait épingler une clé
-- publique dans le manifest, en pleine soumission Web Store. Et
-- web_accessible_resources rendrait l'extension détectable par tous les sites.
--
-- Sens de circulation du secret : l'extension (surface faible) fabrique le
-- secret et attend ; c'est la surface AUTHENTIFIÉE (le web, où l'utilisateur
-- est déjà connecté) qui approuve. Connaître le user_code ne sert à rien sans
-- quelqu'un de connecté pour l'approuver. L'inverse — un code affiché sur /me
-- et recopié dans le popup — donnerait une session à qui lit le code.

create table if not exists public.pairing_requests (
  id uuid primary key default gen_random_uuid(),
  -- Seul le hash est stocké : une fuite de la table ne donne aucune session.
  device_code_hash text not null unique,
  user_code text not null unique,
  -- Affiché à l'approbation (« Chrome sur macOS ») : l'utilisateur doit
  -- pouvoir reconnaître SON navigateur avant d'autoriser.
  user_agent_hint text,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete cascade,
  redeemed_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists pairing_requests_expiry on public.pairing_requests (expires_at);

alter table public.pairing_requests enable row level security;
-- Aucune policy, volontairement : tout passe par les RPC ci-dessous, qui
-- seules savent quoi renvoyer à qui. Une policy de lecture exposerait les
-- user_code en attente à n'importe quel compte.

-- ---------------------------------------------------------------------------
-- 1. L'extension ouvre une demande
-- ---------------------------------------------------------------------------
create or replace function public.create_pairing_request(p_hint text, p_bucket text)
  returns jsonb language plpgsql volatile security definer set search_path = public
as $$
declare
  chars constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  device_code text;
  code text;
  exp timestamptz := now() + interval '10 minutes';
begin
  if not public.rate_hit('pair:' || coalesce(p_bucket, 'anon'), 5, '1 minute') then
    raise exception 'rate_limited';
  end if;

  -- Ménage : une demande expirée n'a plus de raison d'occuper un user_code.
  delete from public.pairing_requests where expires_at < now() - interval '1 hour';

  device_code := encode(extensions.gen_random_bytes(24), 'hex');
  loop
    select string_agg(substr(chars, 1 + floor(random() * length(chars))::int, 1), '')
      into code from generate_series(1, 8);
    exit when not exists (
      select 1 from public.pairing_requests
       where user_code = code and expires_at > now()
    );
  end loop;

  insert into public.pairing_requests (device_code_hash, user_code, user_agent_hint, expires_at)
  values (
    encode(extensions.digest(device_code, 'sha256'), 'hex'),
    code,
    left(coalesce(p_hint, ''), 120),
    exp
  );

  -- device_code n'est renvoyé qu'ici, une seule fois.
  return jsonb_build_object('device_code', device_code, 'user_code', code, 'expires_at', exp);
end $$;
revoke execute on function public.create_pairing_request(text, text) from public;
grant execute on function public.create_pairing_request(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. L'utilisateur connecté approuve depuis le web
-- ---------------------------------------------------------------------------
create or replace function public.approve_pairing(p_user_code text)
  returns jsonb language plpgsql volatile security definer set search_path = public
as $$
declare r public.pairing_requests;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not public.rate_hit('approve:' || auth.uid()::text, 10, '1 hour') then
    raise exception 'rate_limited';
  end if;

  update public.pairing_requests
     set approved_at = now(), approved_by = auth.uid()
   where user_code = upper(trim(coalesce(p_user_code, '')))
     and approved_at is null
     and redeemed_at is null
     and expires_at > now()
  returning * into r;

  if not found then
    raise exception 'invalid_pairing_code';
  end if;
  return jsonb_build_object('approved_at', r.approved_at, 'hint', r.user_agent_hint);
end $$;
revoke execute on function public.approve_pairing(text) from public, anon;
grant execute on function public.approve_pairing(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. L'extension interroge l'état de sa demande
-- ---------------------------------------------------------------------------
-- Ne renvoie QUE le statut : ni e-mail, ni user_id, ni jeton. L'échange
-- contre une session est fait par l'Edge Function `pair-extension`, seule
-- détentrice de la service_role.
create or replace function public.redeem_pairing(p_device_code text)
  returns jsonb language plpgsql volatile security definer set search_path = public
as $$
declare r public.pairing_requests;
begin
  select * into r from public.pairing_requests
   where device_code_hash = encode(extensions.digest(coalesce(p_device_code, ''), 'sha256'), 'hex');
  if not found or r.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;
  if r.redeemed_at is not null then
    return jsonb_build_object('status', 'used');
  end if;
  if r.approved_at is null then
    return jsonb_build_object('status', 'pending');
  end if;
  return jsonb_build_object('status', 'approved');
end $$;
revoke execute on function public.redeem_pairing(text) from public;
grant execute on function public.redeem_pairing(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Purge des demandes périmées
-- ---------------------------------------------------------------------------
-- Les demandes vivent 10 minutes ; la rétention nocturne les balaie aussi, au
-- cas où plus personne n'appellerait create_pairing_request.
create or replace function public.purge_pairing_requests()
  returns integer language plpgsql security definer set search_path = public
as $$
declare n integer;
begin
  delete from public.pairing_requests where expires_at < now() - interval '1 hour';
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.purge_pairing_requests() from public, anon, authenticated;
