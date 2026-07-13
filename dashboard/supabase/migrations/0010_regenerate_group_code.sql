-- Régénération du code d'un groupe par un admin de l'org (l'ancien code cesse
-- immédiatement de fonctionner ; les membres déjà rattachés ne bougent pas).

create or replace function public.regenerate_group_code(p_group uuid)
  returns text language plpgsql security definer set search_path = public
as $$
declare code text;
begin
  if not (public.auth_is_admin() and exists (
    select 1 from public.groups g
    where g.id = p_group and g.org_id = public.auth_org_id())) then
    raise exception 'forbidden';
  end if;
  code := public.generate_join_code();
  update public.groups set join_code = code, join_code_active = true where id = p_group;
  return code;
end $$;
revoke execute on function public.regenerate_group_code(uuid) from anon;
