-- Rôle professeur. Migration isolée : une nouvelle valeur d'enum n'est pas
-- utilisable dans la transaction qui la crée, rien d'autre ne doit vivre ici.

alter type public.user_role add value if not exists 'teacher';
