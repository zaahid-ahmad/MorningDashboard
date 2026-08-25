-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- before deploying the Edge Functions. See README.md, Section 5.

create table if not exists public.user_google_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);

-- Row Level Security is enabled with NO policies attached on purpose:
-- this blocks all access from the client (anon key or a logged-in user's
-- own key) entirely. The only code that ever reads or writes this table
-- is the store-google-token and get-schedule Edge Functions, which use
-- the service-role key — that key bypasses RLS by design and is only
-- ever used server-side (never shipped to the browser).
alter table public.user_google_tokens enable row level security;
