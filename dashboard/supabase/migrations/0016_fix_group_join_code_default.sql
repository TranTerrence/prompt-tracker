-- Correction : la création de groupe échouait avec
-- « permission denied for function generate_join_code » (SQLSTATE 42501).
--
-- Cause : 0004 pose `generate_join_code()` en DEFAULT de groups.join_code, et
-- une expression de DEFAULT est évaluée avec les droits du rôle qui fait
-- l'INSERT (le SECURITY DEFINER n'exempte pas du contrôle d'EXECUTE). 0013 a
-- révoqué EXECUTE à PUBLIC sur cette fonction interne → tout INSERT fait par
-- `authenticated` (server action createGroup) partait en erreur.
--
-- Correctif : on remplace le DEFAULT par un trigger BEFORE INSERT. Postgres ne
-- vérifie pas EXECUTE sur une fonction de trigger au déclenchement (le contrôle
-- a lieu au CREATE TRIGGER), et le corps SECURITY DEFINER appelle
-- generate_join_code() avec les droits du propriétaire. Le verrouillage de 0013
-- reste donc intact : la fonction n'est toujours pas appelable en RPC.

create or replace function public.set_group_join_code()
  returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.join_code is null then
    new.join_code := public.generate_join_code();
  end if;
  return new;
end $$;
-- NB : `revoke ... from public` ne suffit pas, Supabase pose en plus un grant
-- explicite anon/authenticated sur toute fonction nouvellement créée.
revoke execute on function public.set_group_join_code() from public, anon, authenticated;

alter table public.groups alter column join_code drop default;

drop trigger if exists set_group_join_code on public.groups;
create trigger set_group_join_code before insert on public.groups
  for each row execute function public.set_group_join_code();

-- Filet : les groupes créés sans code avant ce correctif.
update public.groups set join_code = public.generate_join_code() where join_code is null;
