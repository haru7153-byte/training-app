-- Run this in the Supabase SQL Editor for this project.
-- Adds the tables needed for the "free basic features + AI features free for
-- 30 days, then subscription required" monetization model.

-- Tracks when each user's free trial started (their first sign-in).
-- Inserted client-side on login; row-level-secured so a user can only see/insert their own.
create table if not exists app_user (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table app_user enable row level security;

create policy "select own app_user" on app_user
  for select using (auth.uid() = user_id);

create policy "insert own app_user" on app_user
  for insert with check (auth.uid() = user_id);

-- Subscription status. Only written by the RevenueCat webhook (via the
-- service role key from a Vercel function) — regular users can read their own
-- row but cannot write it directly, so the paid status can't be spoofed from the app.
create table if not exists subscription (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'none' check (status in ('none', 'trialing', 'active', 'expired', 'cancelled')),
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table subscription enable row level security;

create policy "select own subscription" on subscription
  for select using (auth.uid() = user_id);
