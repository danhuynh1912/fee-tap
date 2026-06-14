-- migration_cycle_vote.sql
-- Adds: shuttle billing cycle + fixed cycle vote settings + period metadata on votes

-- 1. Shuttle billing cycle (global per club)
--    Already used by the engine (estimateShuttle / computePaymentTimeline) — this
--    just persists the user-chosen value so it survives page reloads.
alter table public.club_settings
  add column if not exists shuttle_cycle_months       int not null default 1
    check (shuttle_cycle_months >= 1),
  add column if not exists shuttle_cycle_start_month  int not null default 1
    check (shuttle_cycle_start_month between 1 and 12),
  -- User-chosen cycle for the membership (fixed) vote. NULL = use computed min.
  add column if not exists fixed_cycle_months         int default null
    check (fixed_cycle_months >= 1);

-- 2. Period metadata on votes (nullable — only used for membership_cycle type)
alter table public.votes
  add column if not exists cycle_period_start date default null,
  add column if not exists cycle_period_end   date default null;
