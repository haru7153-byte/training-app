-- Run this in the Supabase SQL Editor for this project.
-- Adds a per-user daily counter for AI feature calls (plan generation,
-- Strava weekly analysis, day review, detailed day analysis), so a single
-- user hammering the buttons can't run up unbounded Anthropic API costs.

create table if not exists ai_usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  count integer not null default 0,
  primary key (user_id, day)
);

alter table ai_usage_daily enable row level security;

create policy "select own ai_usage_daily" on ai_usage_daily
  for select using (auth.uid() = user_id);

-- No insert/update policy for regular users — writes only happen through the
-- increment_ai_usage() function below (security definer), so the count can't
-- be reset or spoofed from the app.

create or replace function increment_ai_usage(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  insert into ai_usage_daily (user_id, day, count)
  values (p_user_id, current_date, 1)
  on conflict (user_id, day) do update set count = ai_usage_daily.count + 1
  returning count into new_count;
  return new_count;
end;
$$;

revoke all on function increment_ai_usage(uuid) from public;
grant execute on function increment_ai_usage(uuid) to authenticated;
