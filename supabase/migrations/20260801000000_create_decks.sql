-- Decks feature: a user can own multiple decks, each holding up to 5 Digi-Egg
-- cards and 50 non-Digi-Egg cards (enforced in the app layer).

create table if not exists decks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null default 'Untitled Deck',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists decks_user_id_idx on decks(user_id);

create table if not exists deck_cards (
  id             uuid primary key default gen_random_uuid(),
  deck_id        uuid not null references decks(id) on delete cascade,
  tcgplayer_id   text not null,
  tcgplayer_name text,
  card_number    text,
  rarity         text,
  card_type      text,
  quantity       integer not null default 1,
  created_at     timestamptz not null default now()
);

create index if not exists deck_cards_deck_id_idx on deck_cards(deck_id);

alter table decks enable row level security;
alter table deck_cards enable row level security;

create policy "decks_select_own" on decks
  for select using (auth.uid() = user_id);
create policy "decks_insert_own" on decks
  for insert with check (auth.uid() = user_id);
create policy "decks_update_own" on decks
  for update using (auth.uid() = user_id);
create policy "decks_delete_own" on decks
  for delete using (auth.uid() = user_id);

create policy "deck_cards_select_own" on deck_cards
  for select using (
    exists (select 1 from decks where decks.id = deck_cards.deck_id and decks.user_id = auth.uid())
  );
create policy "deck_cards_insert_own" on deck_cards
  for insert with check (
    exists (select 1 from decks where decks.id = deck_cards.deck_id and decks.user_id = auth.uid())
  );
create policy "deck_cards_update_own" on deck_cards
  for update using (
    exists (select 1 from decks where decks.id = deck_cards.deck_id and decks.user_id = auth.uid())
  );
create policy "deck_cards_delete_own" on deck_cards
  for delete using (
    exists (select 1 from decks where decks.id = deck_cards.deck_id and decks.user_id = auth.uid())
  );
