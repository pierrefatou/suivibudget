-- À exécuter dans Supabase : Dashboard > SQL Editor > New query > Run
--
-- Crée une table de stockage clé-valeur simple, partitionnée par "clé de
-- synchronisation" (un identifiant aléatoire généré par l'app, pas un compte
-- utilisateur). Aucune authentification n'est requise.
--
-- ATTENTION SÉCURITÉ : la policy ci-dessous autorise TOUTE personne possédant
-- ta clé publique "anon" à lire/écrire N'IMPORTE QUELLE ligne de cette table,
-- quelle que soit la sync_key. Il n'y a pas de séparation forcée par la base
-- de données : la clé de synchronisation ne protège que par obscurité (comme
-- un lien secret). N'utilise pas cette table pour des données sensibles.

create table if not exists kv_store (
  sync_key text not null,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (sync_key, key)
);

alter table kv_store enable row level security;

drop policy if exists "Accès public kv_store" on kv_store;
create policy "Accès public kv_store"
  on kv_store
  for all
  using (true)
  with check (true);
