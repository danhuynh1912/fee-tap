-- =====================================================================
--  FEETAP — Migration: Court Slot Refactor
--
--  Run this in Supabase SQL Editor (one-time).
--  Safe to re-run (all operations are idempotent).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. COURT_SLOTS — one row per booking pattern (court + price + cycle)
-- ---------------------------------------------------------------------
create table if not exists public.court_slots (
  id                  uuid primary key default gen_random_uuid(),
  club_id             uuid not null references public.clubs(id) on delete cascade,
  name                text not null,               -- display name, e.g. "Sân ABC · T2 giờ vàng"
  venue_name          text,                        -- optional grouping key, e.g. "Sân ABC"
  weekdays            smallint[] not null,         -- JS weekday numbers: 0=Sun,1=Mon…6=Sat
  price_per_hour      numeric not null default 0,
  hours_per_session   numeric not null default 2,
  payment_mode        text not null default 'session'
                        check (payment_mode in ('session', 'cycle')),
  billing_cycle       text not null default 'month'
                        check (billing_cycle in ('month', 'quarter')),
  quarter_start_month smallint default 1
                        check (quarter_start_month between 1 and 12),
  renewal_day         smallint                     -- day-of-month in the month BEFORE period starts
                        check (renewal_day between 1 and 31),
  sort_order          smallint not null default 0,
  created_at          timestamptz not null default now()
);

create index if not exists court_slots_club_id_idx on public.court_slots (club_id);

-- ---------------------------------------------------------------------
-- 2. CLUB_SETTINGS — new columns (shuttle mode + fee split mode)
-- ---------------------------------------------------------------------
alter table public.club_settings
  add column if not exists shuttle_mode   text not null default 'estimate'
    check (shuttle_mode in ('estimate', 'inventory')),
  add column if not exists shuttle_stock  numeric not null default 0,
  add column if not exists fee_split_mode text not null default 'committed_only'
    check (fee_split_mode in ('total_members', 'committed_only')),
  -- keep session_configs for backward-compat read during migration window
  add column if not exists session_configs jsonb;

-- ---------------------------------------------------------------------
-- 3. FUND_TRANSACTIONS — add type column
-- ---------------------------------------------------------------------
alter table public.fund_transactions
  add column if not exists type text not null default 'manual'
    check (type in ('manual', 'shuttle_purchase', 'session_deduct', 'top_up'));

-- ---------------------------------------------------------------------
-- 4. RLS for court_slots
-- ---------------------------------------------------------------------
alter table public.court_slots enable row level security;

drop policy if exists court_slots_read  on public.court_slots;
create policy court_slots_read on public.court_slots for select using (true);

drop policy if exists court_slots_write on public.court_slots;
create policy court_slots_write on public.court_slots for all
  using (
    exists (select 1 from public.clubs c
            where c.id = court_slots.club_id and c.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.clubs c
            where c.id = court_slots.club_id and c.owner_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- 5. REALTIME — add court_slots to publication
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'court_slots') then
    alter publication supabase_realtime add table public.court_slots;
  end if;
end $$;

-- Done. ✅
