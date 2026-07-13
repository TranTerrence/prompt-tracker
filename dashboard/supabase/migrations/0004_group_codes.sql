-- Codes de classe (modèle Google Classroom) : l'étudiant saisit un code court,
-- le rattachement org + groupe est atomique via une RPC security definer.
-- Corrige au passage la faille d'auto-rattachement : profiles_update_own
-- laissait un membre changer son propre org_id vers n'importe quelle org.

-- Colonnes de code sur les groupes
alter table public.groups
  add column if not exists join_code text,
  add column if not exists join_code_active boolean not null default true,
  add column if not exists join_code_expires_at timestamptz;

create unique index if not exists groups_join_code_key
  on public.groups (upper(join_code)) where join_code is not null;

-- Génération : 7 caractères, alphabet sans ambiguïté (pas de I/L/O/0/1)
create or replace function public.generate_join_code()
  returns text language plpgsql volatile security definer set search_path = public
as $$
declare
  chars constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    select string_agg(substr(chars, 1 + floor(random() * length(chars))::int, 1), '')
      into code from generate_series(1, 7);
    exit when not exists (select 1 from public.groups where upper(join_code) = code);
  end loop;
  return code;
end $$;
revoke execute on function public.generate_join_code() from anon, authenticated;

-- Les nouveaux groupes reçoivent un code d'office
alter table public.groups alter column join_code set default public.generate_join_code();
update public.groups set join_code = public.generate_join_code() where join_code is null;

-- Verrou : un non-admin ne change jamais org_id / role / disabled lui-même.
-- Seule la RPC de join (qui pose le GUC transactionnel) peut modifier org_id.
create or replace function public.protect_profile_fields()
  returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(current_setting('app.allow_org_change', true), '') = 'on' then
    return new;
  end if;
  if auth.uid() is null then
    return new; -- service_role / SQL direct : pas une session utilisateur
  end if;
  if public.auth_is_admin() then
    return new;
  end if;
  if new.org_id is distinct from old.org_id
     or new.role is distinct from old.role
     or new.disabled is distinct from old.disabled then
    raise exception 'protected_fields';
  end if;
  return new;
end $$;
revoke execute on function public.protect_profile_fields() from anon, authenticated;

drop trigger if exists protect_profile_fields on public.profiles;
create trigger protect_profile_fields before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- RPC de join : code → rattachement org + groupe, atomique.
create or replace function public.join_group_with_code(p_code text)
  returns jsonb language plpgsql security definer set search_path = public
as $$
declare g record;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  select gr.id, gr.org_id, gr.name, o.brand_name, o.name as org_name
    into g
    from public.groups gr
    join public.organizations o on o.id = gr.org_id
   where upper(gr.join_code) = upper(trim(p_code))
     and gr.join_code_active
     and (gr.join_code_expires_at is null or gr.join_code_expires_at > now());
  if not found then
    raise exception 'invalid_code';
  end if;
  if exists (select 1 from public.profiles
             where id = auth.uid() and org_id is not null and org_id <> g.org_id) then
    raise exception 'already_in_other_org';
  end if;

  perform set_config('app.allow_org_change', 'on', true);
  update public.profiles set org_id = g.org_id where id = auth.uid();
  insert into public.group_members (group_id, user_id)
    values (g.id, auth.uid())
    on conflict do nothing;

  return jsonb_build_object(
    'org_id', g.org_id,
    'group_id', g.id,
    'group_name', g.name,
    'org_name', coalesce(g.brand_name, g.org_name)
  );
end $$;
revoke execute on function public.join_group_with_code(text) from anon;
