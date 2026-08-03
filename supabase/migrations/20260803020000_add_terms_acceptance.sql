-- Tracks when a user accepted the platform disclaimer/terms during onboarding.
-- Null means they haven't (yet) — existing users predate this and are left null.

alter table profiles add column if not exists terms_accepted_at timestamptz;
