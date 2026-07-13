-- Droit à l'effacement : l'utilisateur peut purger le CONTENU qu'il a déjà
-- partagé (texte, dialogue, réflexions, clés de conversation), sans toucher
-- aux indicateurs. RPC security definer : aucune policy update n'est ouverte
-- aux membres sur les tables d'événements, c'est voulu.

create or replace function public.purge_my_content()
  returns jsonb language plpgsql security definer set search_path = public
as $$
declare n_events integer; n_posts integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  update public.prompt_events
     set text = null, dialogue = null, conv_key = null
   where user_id = auth.uid()
     and (text is not null or dialogue is not null or conv_key is not null);
  get diagnostics n_events = row_count;
  update public.post_events
     set answer = null, conv_key = null
   where user_id = auth.uid()
     and (answer is not null or conv_key is not null);
  get diagnostics n_posts = row_count;
  return jsonb_build_object('events_purged', n_events, 'posts_purged', n_posts);
end $$;
revoke execute on function public.purge_my_content() from anon;
