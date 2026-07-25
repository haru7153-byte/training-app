-- Run this in the Supabase SQL Editor for this project.
-- Lets a training_plan target either a specific race (existing behavior)
-- or an ongoing, date-less goal (fitness, climbing, criteriums, etc.),
-- and makes the FTP-test cadence optional.

alter table training_plan
  add column if not exists goal_type text not null default 'race'
  check (goal_type in ('race', 'ongoing'));

alter table training_plan
  add column if not exists ftp_test_enabled boolean not null default true;

-- Ongoing goals have no target date.
alter table training_plan
  alter column event_date drop not null;
