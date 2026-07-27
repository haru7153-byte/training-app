-- RIDEVERSE MVP schema: the minimum needed for "generate one unique veria".
-- Aligned with Velia Generation Reference v1.0.
-- Run against a Supabase project (SQL editor or `supabase db push`).

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.velias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  species text not null,
  appearance text not null,
  personality text not null,
  keywords jsonb not null default '[]'::jsonb,
  voice_tone text not null,
  greeting text not null,
  favorite_ride text not null,
  favorite_season text not null,
  image_url text not null,
  image_prompt text not null,
  bike_type text not null,
  bike_manufacturer text,
  bike_model text,
  bike_main_color text,
  bike_accent_color text,
  birthday date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.generation_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  veria_id uuid references public.velias (id) on delete set null,
  bike_info jsonb not null,
  answers jsonb not null,
  name_candidates jsonb not null,
  chosen_name text not null,
  raw_ai_profile jsonb,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;
alter table public.velias enable row level security;
alter table public.generation_history enable row level security;

create policy "users can manage their own profile" on public.users
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "users can manage their own velias" on public.velias
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users can manage their own generation history" on public.generation_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Storage buckets are created via the dashboard/CLI (SQL alone can't create them):
--   supabase storage buckets create bike-photos --public
--   supabase storage buckets create veria-images --public
-- Both should be public-read (profile images) with insert/update restricted to
-- the authenticated owner via a storage policy keyed on the `${auth.uid()}/...` path prefix.
