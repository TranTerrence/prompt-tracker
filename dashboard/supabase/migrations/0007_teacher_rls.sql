-- Rôle professeur : lecture des étudiants de SES groupes uniquement.
-- Helpers en security definer (indispensable : une policy sur group_members
-- qui interroge group_members récurserait). Resserre au passage la fuite
-- existante : group_members et groups étaient lisibles par toute l'org.

create or replace function public.auth_is_teacher()
  returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce((select role = 'teacher' and not disabled
                   from public.profiles where id = auth.uid()), false)
$$;

-- Le prof « enseigne à » un utilisateur s'ils partagent au moins un groupe.
create or replace function public.auth_teaches(p_target uuid)
  returns boolean language sql stable security definer set search_path = public
as $$
  select public.auth_is_teacher() and exists (
    select 1 from public.group_members t
    join public.group_members s using (group_id)
    where t.user_id = auth.uid() and s.user_id = p_target)
$$;

create or replace function public.auth_in_group(p_group uuid)
  returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.group_members
                 where group_id = p_group and user_id = auth.uid())
$$;

-- prompt_events : + branche teacher (le contenu stocké est déjà consenti
-- par construction, voir enforce_consent).
drop policy if exists events_select on public.prompt_events;
create policy events_select on public.prompt_events for select
  using (user_id = auth.uid()
    or (public.auth_is_admin() and org_id = public.auth_org_id())
    or (org_id = public.auth_org_id() and public.auth_teaches(user_id)));

-- post_events : mêmes trois branches.
drop policy if exists post_events_select on public.post_events;
create policy post_events_select on public.post_events for select
  using (user_id = auth.uid()
    or (public.auth_is_admin() and org_id = public.auth_org_id())
    or (org_id = public.auth_org_id() and public.auth_teaches(user_id)));

-- profiles : + le prof voit les profils de ses élèves.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid()
    or (public.auth_is_admin() and org_id = public.auth_org_id())
    or public.auth_teaches(id));

-- group_members : RESSERRÉ (soi-même / admin org / prof du groupe).
drop policy if exists group_members_select on public.group_members;
create policy group_members_select on public.group_members for select
  using (user_id = auth.uid()
    or (public.auth_is_admin() and exists (
      select 1 from public.groups g
      where g.id = group_members.group_id and g.org_id = public.auth_org_id()))
    or (public.auth_is_teacher() and public.auth_in_group(group_members.group_id)));

-- groups : RESSERRÉ (mes groupes / admin org). Le join par code passe par la
-- RPC security definer, aucun select nécessaire pour rejoindre.
drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups for select
  using ((public.auth_is_admin() and org_id = public.auth_org_id())
    or public.auth_in_group(id));

-- consents : + le prof lit les consentements de ses élèves (badges).
drop policy if exists consents_read_teacher on public.consents;
create policy consents_read_teacher on public.consents for select
  using (public.auth_teaches(user_id));
