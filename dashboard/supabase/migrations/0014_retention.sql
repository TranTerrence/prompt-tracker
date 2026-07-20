-- Minimisation de la conservation (annoncée dans la divulgation, la politique
-- de confidentialité et la fiche Web Store) :
--   * CONTENU (texte, dialogue, réflexions, clés de conversation) : effacé
--     au bout de 90 jours — un trimestre, la fenêtre pédagogique utile.
--   * ÉVÉNEMENTS (indicateurs/scores) : supprimés au bout de 12 mois — une
--     année scolaire, la fenêtre des courbes de progression.
-- Exécution chaque nuit via pg_cron. La fonction est aussi appelable à la
-- main (service role) pour un premier passage.

create or replace function public.apply_retention()
  returns jsonb language plpgsql security definer set search_path = public
as $$
declare n_events_anonymized integer; n_posts_anonymized integer;
        n_events_deleted integer; n_posts_deleted integer;
begin
  -- 90 jours : le contenu s'efface, les indicateurs restent.
  update public.prompt_events
     set text = null, dialogue = null, conv_key = null
   where ts < now() - interval '90 days'
     and (text is not null or dialogue is not null or conv_key is not null);
  get diagnostics n_events_anonymized = row_count;

  update public.post_events
     set answer = null, conv_key = null
   where ts < now() - interval '90 days'
     and (answer is not null or conv_key is not null);
  get diagnostics n_posts_anonymized = row_count;

  -- 12 mois : les événements eux-mêmes disparaissent.
  delete from public.prompt_events where ts < now() - interval '12 months';
  get diagnostics n_events_deleted = row_count;

  delete from public.post_events where ts < now() - interval '12 months';
  get diagnostics n_posts_deleted = row_count;

  return jsonb_build_object(
    'events_anonymized', n_events_anonymized,
    'posts_anonymized', n_posts_anonymized,
    'events_deleted', n_events_deleted,
    'posts_deleted', n_posts_deleted
  );
end $$;
revoke execute on function public.apply_retention() from anon, authenticated;

-- Planification nocturne (03:30 UTC). unschedule d'abord : la migration est
-- rejouable sans créer de doublon.
create extension if not exists pg_cron;
do $$ begin
  perform cron.unschedule('retention-nightly');
exception when others then null; end $$;
select cron.schedule('retention-nightly', '30 3 * * *', $$select public.apply_retention()$$);
