-- Correctif : pgcrypto est installé dans le schéma `extensions` chez Supabase,
-- et api_auth fixe search_path = public. Qualification explicite.

create or replace function public.api_auth(p_key text, p_scope text)
  returns public.org_api_keys language plpgsql volatile security definer set search_path = public
as $$
declare k public.org_api_keys;
begin
  select * into k from public.org_api_keys
   where key_hash = encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex')
     and revoked_at is null;
  if not found then raise exception 'invalid_key'; end if;
  if not (p_scope = any (k.scopes)) then raise exception 'forbidden_scope'; end if;
  if not public.api_hit(k.id) then raise exception 'rate_limited'; end if;
  update public.org_api_keys set last_used_at = now()
   where id = k.id and (last_used_at is null or last_used_at < now() - interval '1 minute');
  return k;
end $$;
revoke execute on function public.api_auth(text, text) from anon, authenticated;
