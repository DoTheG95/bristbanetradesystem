-- Needed to sort the main deck by level (Digimon) then name, and to persist
-- that order across reloads.

alter table deck_cards add column if not exists level integer;
alter table deck_cards add column if not exists sort_order integer not null default 0;
