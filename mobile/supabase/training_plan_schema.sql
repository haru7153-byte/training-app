-- Run this in the Supabase SQL Editor for this project.
-- Adds long-term training plan tables (training_plan / plan_week / plan_day).
-- Single-user app, same convention as existing ftp_log / weight_log tables (no user_id column).

create table training_plan (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  event_date date not null,
  start_date date not null,
  starting_ftp integer not null,
  goal_ftp integer not null,
  weekly_target_tss integer not null,
  platform text not null,
  rest_day_indices integer[] not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);

create table plan_week (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references training_plan(id) on delete cascade,
  week_number integer not null,
  week_start_date date not null,
  phase text not null check (phase in ('Base', 'Build', 'Peak', 'Taper')),
  is_recovery_week boolean not null default false,
  has_ftp_test boolean not null default false,
  ftp_test_day integer,
  target_tss integer not null,
  rest_day_indices integer[] not null,
  detail_status text not null default 'pending' check (detail_status in ('pending', 'generated'))
);

create table plan_day (
  id uuid primary key default gen_random_uuid(),
  plan_week_id uuid not null references plan_week(id) on delete cascade,
  date date not null,
  day_of_week integer not null,
  type text not null check (type in ('workout', 'rest', 'ftp_test')),
  platform text,
  name text,
  duration integer,
  planned_tss integer,
  zone text,
  description text,
  strava_activity_id bigint,
  actual_tss integer,
  actual_duration integer,
  achievement_pct numeric,
  review_status text default 'pending' check (
    review_status in ('pending', 'completed', 'partial', 'not_done', 'rest_ok', 'rest_skipped')
  ),
  review_comment text
);

create index plan_week_plan_id_idx on plan_week(plan_id);
create index plan_day_week_id_idx on plan_day(plan_week_id);
create index plan_day_date_idx on plan_day(date);

alter table training_plan enable row level security;
alter table plan_week enable row level security;
alter table plan_day enable row level security;

-- Mirrors the open-access policy used by ftp_log / weight_log in this project.
-- Adjust if those tables use a stricter policy.
create policy "allow all" on training_plan for all using (true) with check (true);
create policy "allow all" on plan_week for all using (true) with check (true);
create policy "allow all" on plan_day for all using (true) with check (true);
