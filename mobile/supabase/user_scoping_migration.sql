-- Run this in the Supabase SQL Editor for this project.
-- Scopes weight_log / ftp_log / training_plan / plan_week / plan_day to the
-- authenticated user, replacing the old "single-user, allow all" policies.

-- Step 1: find your own user id (run this first, then paste the uuid below).
-- select id, email from auth.users where email = 'haru7153@gmail.com';

-- Step 2: add user_id columns (nullable for now, so backfill can run).
alter table weight_log     add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table ftp_log        add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table training_plan  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table plan_week      add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table plan_day       add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Step 3: backfill existing rows with your own user id.
update weight_log    set user_id = 'ff20b043-b7d0-4218-bedf-a4241be02fbe' where user_id is null;
update ftp_log       set user_id = 'ff20b043-b7d0-4218-bedf-a4241be02fbe' where user_id is null;
update training_plan set user_id = 'ff20b043-b7d0-4218-bedf-a4241be02fbe' where user_id is null;
update plan_week     set user_id = 'ff20b043-b7d0-4218-bedf-a4241be02fbe' where user_id is null;
update plan_day      set user_id = 'ff20b043-b7d0-4218-bedf-a4241be02fbe' where user_id is null;

-- Step 4: enforce not-null and default new rows to the calling user automatically,
-- so existing .insert({...}) calls in the app don't need to pass user_id at all.
alter table weight_log     alter column user_id set not null, alter column user_id set default auth.uid();
alter table ftp_log        alter column user_id set not null, alter column user_id set default auth.uid();
alter table training_plan  alter column user_id set not null, alter column user_id set default auth.uid();
alter table plan_week      alter column user_id set not null, alter column user_id set default auth.uid();
alter table plan_day       alter column user_id set not null, alter column user_id set default auth.uid();

-- Step 5: make sure RLS is on, then drop every existing policy on these tables
-- (handles "allow all" and any other previously-named policies) and replace
-- with per-user policies.
alter table weight_log     enable row level security;
alter table ftp_log        enable row level security;
alter table training_plan  enable row level security;
alter table plan_week      enable row level security;
alter table plan_day       enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select policyname, tablename
    from pg_policies
    where tablename in ('weight_log', 'ftp_log', 'training_plan', 'plan_week', 'plan_day')
  loop
    execute format('drop policy if exists %I on %I', pol.policyname, pol.tablename);
  end loop;
end $$;

create policy "own rows only" on weight_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows only" on ftp_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows only" on training_plan
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows only" on plan_week
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows only" on plan_day
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
