-- =====================================================================
--  FEETAP — Supabase / PostgreSQL Schema (additive over PollTap)
--
--  FeeTap shares ONE Supabase project with PollTap. This script:
--    • extends the existing `clubs` / `votes` / `responses` tables with
--      the few columns FeeTap needs (idempotent — safe to re-run), and
--    • creates the FeeTap-only tables: `club_settings`, `club_members`,
--      `session_logs`.
--
--  Run PollTap's supabase/schema.sql FIRST, then paste & run this.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 0. EXTEND SHARED TABLES (PollTap created these)
-- ---------------------------------------------------------------------

-- Clubs gain an OAuth owner + a billing plan (free | pro).
alter table public.clubs add column if not exists owner_id uuid;          -- auth.users.id of the host
alter table public.clubs add column if not exists plan text not null default 'free'
  check (plan in ('free', 'pro'));

-- Votes gain a type so FeeTap can find the "membership cycle" registration
-- poll (attendance polls stay the implicit default).
alter table public.votes add column if not exists vote_type text not null default 'attendance'
  check (vote_type in ('attendance', 'membership_cycle'));

-- NOTE: PollTap stores a responder's extra heads in `responses.guests`.
-- FeeTap treats that column as the "plus_count" when tallying the roster.

-- ---------------------------------------------------------------------
-- 1. CLUB_SETTINGS — the forecasting engine inputs (one row per club)
-- ---------------------------------------------------------------------
create table if not exists public.club_settings (
  club_id                 uuid primary key references public.clubs(id) on delete cascade,
  court_price_per_hour    numeric  not null default 120000,  -- VND / hour
  hours_per_session       numeric  not null default 2,       -- hours per match session
  sessions_per_week       integer  not null default 2,       -- legacy fallback (= count of play_weekdays)
  play_weekdays           smallint[] not null default '{}',  -- which weekdays the club plays (0=Sun … 6=Sat)
  billing_cycle           text     not null default 'month'  -- 'month' | 'quarter'
                           check (billing_cycle in ('month', 'quarter')),
  quarter_start_month     smallint check (quarter_start_month between 1 and 12), -- anchor for quarter cycles
  price_per_box           numeric  not null default 320000,  -- VND / box (12 shuttlecocks)
  estimated_shuttlecocks  numeric  not null default 6,       -- "độ hao cầu" — balls / session
  current_fund            numeric  not null default 0,       -- current cash in the club fund
  updated_at              timestamptz not null default now()
);

-- Migration for existing club_settings tables (idempotent):
alter table public.club_settings
  add column if not exists play_weekdays       smallint[] not null default '{}',
  add column if not exists quarter_start_month smallint
    check (quarter_start_month between 1 and 12);

-- ---------------------------------------------------------------------
-- 2. CLUB_MEMBERS — the registration list (Free plan caps this at 15)
--    `user_id` links a Google-authenticated member to their club so they
--    get the read-only transparency dashboard.
-- ---------------------------------------------------------------------
create table if not exists public.club_members (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  user_id     uuid,                       -- auth.users.id, null for manually-added names
  name        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists club_members_club_id_idx on public.club_members (club_id);

-- ---------------------------------------------------------------------
-- 3. SESSION_LOGS — post-match actuals (variance vs the estimate)
-- ---------------------------------------------------------------------
create table if not exists public.session_logs (
  id                  uuid primary key default gen_random_uuid(),
  club_id             uuid not null references public.clubs(id) on delete cascade,
  played_on           date not null default current_date,
  actual_shuttlecocks numeric not null default 0,
  note                text,
  created_at          timestamptz not null default now()
);
create index if not exists session_logs_club_id_idx on public.session_logs (club_id);

-- Keep club_settings.updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_club_settings_updated_at on public.club_settings;
create trigger trg_club_settings_updated_at
  before update on public.club_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
--    Authenticated users (Google OAuth) can read everything in their
--    ecosystem; writes are gated to the club owner. The anon key is still
--    used by PollTap's no-login voting, so we keep public read where the
--    forecasting cross-query needs it.
-- ---------------------------------------------------------------------
alter table public.club_settings enable row level security;
alter table public.club_members  enable row level security;
alter table public.session_logs  enable row level security;

-- CLUB_SETTINGS: anyone can read (members see transparency); only the
-- club owner can write.
drop policy if exists club_settings_read on public.club_settings;
create policy club_settings_read on public.club_settings for select using (true);

drop policy if exists club_settings_write on public.club_settings;
create policy club_settings_write on public.club_settings for all
  using (
    exists (select 1 from public.clubs c
            where c.id = club_settings.club_id and c.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.clubs c
            where c.id = club_settings.club_id and c.owner_id = auth.uid())
  );

-- CLUB_MEMBERS: readable by all; writable by the club owner.
drop policy if exists club_members_read on public.club_members;
create policy club_members_read on public.club_members for select using (true);

drop policy if exists club_members_write on public.club_members;
create policy club_members_write on public.club_members for all
  using (
    exists (select 1 from public.clubs c
            where c.id = club_members.club_id and c.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.clubs c
            where c.id = club_members.club_id and c.owner_id = auth.uid())
  );

-- SESSION_LOGS: readable by all; writable by the club owner.
drop policy if exists session_logs_read on public.session_logs;
create policy session_logs_read on public.session_logs for select using (true);

drop policy if exists session_logs_write on public.session_logs;
create policy session_logs_write on public.session_logs for all
  using (
    exists (select 1 from public.clubs c
            where c.id = session_logs.club_id and c.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.clubs c
            where c.id = session_logs.club_id and c.owner_id = auth.uid())
  );

-- Allow authenticated users to create a club they own and update it.
-- (PollTap already grants open insert/select on clubs via the anon key;
--  here we add an owner-gated UPDATE for the plan toggle & renames.)
drop policy if exists clubs_owner_update on public.clubs;
create policy clubs_owner_update on public.clubs for update
  using (owner_id = auth.uid() or owner_id is null)
  with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------
-- 5. REALTIME — keep the fund dashboard live across devices
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and tablename='club_settings') then
    alter publication supabase_realtime add table public.club_settings;
  end if;
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and tablename='club_members') then
    alter publication supabase_realtime add table public.club_members;
  end if;
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and tablename='session_logs') then
    alter publication supabase_realtime add table public.session_logs;
  end if;
end $$;

-- Done. ✅
