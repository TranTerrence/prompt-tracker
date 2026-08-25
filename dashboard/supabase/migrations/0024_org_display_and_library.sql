-- Deux réglages d'organisation demandés par le Bachelor I-BE³ (Mines Paris –
-- PSL) dans son cahier des charges du 25/08/2026.
--
-- 1. show_score — masquer TOUT ce qui est chiffré dans l'extension.
--    Ce que l'étudiant doit lire est un comportement (« ai-je réfléchi avant
--    de demander ») et non une note sur cent, qui se transforme
--    immédiatement en objectif à optimiser. Le score continue d'être
--    calculé, stocké et servi par l'API : c'est l'AFFICHAGE qui se tait.
--    Sans ce réglage, le score restait visible dans l'extension alors qu'il
--    avait disparu de l'application de l'école — incohérent pour l'étudiant.
--
-- 2. library_url — la bibliothèque de prompts que l'organisation publie, et
--    que l'extension propose à l'ouverture du miroir.
--    L'extension la lit SANS AUCUNE IDENTITÉ (credentials omis, aucun
--    en-tête d'authentification, aucun paramètre dérivé du compte) : c'est un
--    contenu que l'organisation publie, jamais un canal de remontée. La
--    permission d'hôte correspondante est FACULTATIVE côté extension et
--    demandée à l'utilisateur, qui peut refuser sans rien perdre d'autre.
--
-- Migration purement additive : aucune policy à modifier, org_select et
-- org_update (0001) couvrent déjà toutes les colonnes de la table.

alter table public.organizations
  add column if not exists show_score boolean not null default true;

alter table public.organizations
  add column if not exists library_url text;

-- https obligatoire : l'extension refuserait de toute façon un autre schéma,
-- autant que la base le dise aussi — une URL en http ne serait jamais
-- récupérée et l'admin ne comprendrait pas pourquoi.
do $$
begin
  alter table public.organizations
    add constraint organizations_library_url_https
    check (library_url is null or library_url like 'https://%');
exception
  when duplicate_object then null;
end $$;

comment on column public.organizations.show_score is
  'false : l''extension n''affiche aucun chiffre (total, rubriques, seuil, tendance). La mesure et l''API sont inchangées.';
comment on column public.organizations.library_url is
  'URL https d''une bibliothèque de prompts publiée par l''organisation (format documenté dans docs/INTEGRATION.md). Lue sans identité.';
