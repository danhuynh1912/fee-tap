-- =====================================================================
--  FEETAP — Migration: Payment Collections (Bank-grade)
--
--  Run AFTER schema.sql and migration_court_slots.sql.
--  Safe to re-run (all operations are idempotent).
--
--  BEFORE running step 7 (drop current_fund), verify reconciliation:
--    SELECT cs.current_fund, COALESCE(SUM(ft.amount),0) AS ledger_sum,
--           cs.current_fund - COALESCE(SUM(ft.amount),0) AS gap
--    FROM club_settings cs
--    LEFT JOIN fund_transactions ft ON ft.club_id = cs.club_id
--    GROUP BY cs.club_id, cs.current_fund;
--
--  If gap != 0 for any club, insert a reconciliation entry:
--    INSERT INTO fund_transactions (club_id, amount, type, source, note)
--    VALUES ('<club_id>', <gap>, 'manual', 'migration', 'Số dư khởi đầu trước migration');
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Extend fund_transactions — append-only ledger columns
-- ---------------------------------------------------------------------
alter table public.fund_transactions
  add column if not exists source text not null default 'manual'
    check (source in ('payos', 'manual', 'admin_manual', 'session_log', 'migration')),
  add column if not exists member_id uuid references public.club_members(id),
  add column if not exists payment_record_id uuid,  -- FK added after member_payment_records is created
  add column if not exists reversal_of uuid references public.fund_transactions(id),
  add column if not exists currency char(3) not null default 'VND';

-- Extend existing type check to include member_payment and reversal
do $$ begin
  alter table public.fund_transactions
    drop constraint if exists fund_transactions_type_check;
  alter table public.fund_transactions
    add constraint fund_transactions_type_check
    check (type in ('manual','shuttle_purchase','session_deduct','top_up','member_payment','reversal'));
exception when others then null; end $$;

-- Enforce append-only via RLS (no UPDATE or DELETE by anyone)
drop policy if exists fund_transactions_no_update on public.fund_transactions;
create policy fund_transactions_no_update on public.fund_transactions
  for update using (false);

drop policy if exists fund_transactions_no_delete on public.fund_transactions;
create policy fund_transactions_no_delete on public.fund_transactions
  for delete using (false);

-- ---------------------------------------------------------------------
-- 2. Sequence for PayOS order codes (integer, required by PayOS API)
-- ---------------------------------------------------------------------
create sequence if not exists public.payos_order_seq
  start with 100001 increment by 1 no maxvalue cache 1;

-- RPC so Edge Functions can get next order code
create or replace function public.next_payos_order_code()
returns bigint language sql security definer as $$
  select nextval('public.payos_order_seq');
$$;

-- ---------------------------------------------------------------------
-- 3. payment_collections — one row per "đợt thu" opened by admin
-- ---------------------------------------------------------------------
create table if not exists public.payment_collections (
  id              uuid primary key default gen_random_uuid(),
  club_id         uuid not null references public.clubs(id) on delete cascade,
  period_start    date not null,       -- first day of billing period (used as unique key)
  deadline        date,                -- when collection is due
  title           text,                -- display label, e.g. "Tiền sân T8–T10 2026"
  amount_per_member int not null,      -- VND — frozen at creation time
  status          text not null default 'open' check (status in ('open', 'closed')),
  created_by      uuid,                -- auth.users.id of the admin who opened it
  created_at      timestamptz not null default now(),
  unique (club_id, period_start)
);

create index if not exists payment_collections_club_id_idx on public.payment_collections (club_id);

-- ---------------------------------------------------------------------
-- 4. member_payment_records — one row per member per collection
-- ---------------------------------------------------------------------
create table if not exists public.member_payment_records (
  id                    uuid primary key default gen_random_uuid(),
  collection_id         uuid not null references public.payment_collections(id) on delete cascade,
  club_id               uuid not null references public.clubs(id) on delete cascade,
  member_id             uuid not null references public.club_members(id) on delete cascade,
  amount                int not null,           -- VND — frozen at creation
  currency              char(3) not null default 'VND',
  status                text not null default 'pending'
                          check (status in ('pending', 'paid', 'manual')),
  payos_order_code      bigint unique,          -- used to match PayOS webhook
  payos_checkout_url    text,
  payos_qr_code         text,                   -- raw EMVCo QR string
  paid_at               timestamptz,
  confirmed_by          text,                   -- 'payos_webhook' | 'admin_manual'
  confirmed_by_user_id  uuid,
  created_at            timestamptz not null default now(),
  unique (collection_id, member_id)
);

create index if not exists mpr_club_id_idx on public.member_payment_records (club_id);
create index if not exists mpr_collection_id_idx on public.member_payment_records (collection_id);
create index if not exists mpr_member_id_idx on public.member_payment_records (member_id);
create index if not exists mpr_order_code_idx on public.member_payment_records (payos_order_code);

-- Now add the FK from fund_transactions to member_payment_records
do $$ begin
  alter table public.fund_transactions
    add constraint fk_fund_tx_payment_record
    foreign key (payment_record_id) references public.member_payment_records(id);
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 5. Atomic RPC: confirm_member_payment
--    Called by the PayOS webhook Edge Function (security definer = runs
--    as postgres, bypasses RLS, safe to call from service role).
-- ---------------------------------------------------------------------
create or replace function public.confirm_member_payment(
  p_record_id       uuid,
  p_confirmed_by    text  default 'payos_webhook',
  p_user_id         uuid  default null
) returns jsonb language plpgsql security definer as $$
declare
  v record;
  v_member_name text;
begin
  -- Lock row to prevent race conditions
  select mpr.*, cm.name as member_name
  into v
  from public.member_payment_records mpr
  join public.club_members cm on cm.id = mpr.member_id
  where mpr.id = p_record_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'record_not_found');
  end if;

  -- Idempotency: already confirmed
  if v.status in ('paid', 'manual') then
    return jsonb_build_object('ok', true, 'skipped', true);
  end if;

  -- Mark as paid (atomic)
  update public.member_payment_records set
    status               = case when p_confirmed_by = 'admin_manual' then 'manual' else 'paid' end,
    paid_at              = now(),
    confirmed_by         = p_confirmed_by,
    confirmed_by_user_id = p_user_id
  where id = p_record_id;

  -- Append-only fund ledger entry
  insert into public.fund_transactions (
    club_id, member_id, payment_record_id, amount, currency,
    type, source, note
  ) values (
    v.club_id,
    v.member_id,
    v.id,
    v.amount,
    v.currency,
    'member_payment',
    p_confirmed_by,
    case when p_confirmed_by = 'admin_manual'
      then 'Thu tiền mặt: ' || v.member_name
      else 'PayOS: ' || v.member_name
    end
  );

  return jsonb_build_object('ok', true, 'amount', v.amount, 'member', v.member_name);
end;
$$;

-- ---------------------------------------------------------------------
-- 6. RLS — payment_collections
-- ---------------------------------------------------------------------
alter table public.payment_collections enable row level security;

drop policy if exists payment_collections_read on public.payment_collections;
create policy payment_collections_read on public.payment_collections
  for select using (true);

drop policy if exists payment_collections_write on public.payment_collections;
create policy payment_collections_write on public.payment_collections
  for insert with check (
    exists (select 1 from public.clubs c
            where c.id = payment_collections.club_id and c.owner_id = auth.uid())
  );

drop policy if exists payment_collections_update on public.payment_collections;
create policy payment_collections_update on public.payment_collections
  for update using (
    exists (select 1 from public.clubs c
            where c.id = payment_collections.club_id and c.owner_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- 7. RLS — member_payment_records
-- ---------------------------------------------------------------------
alter table public.member_payment_records enable row level security;

drop policy if exists mpr_read on public.member_payment_records;
create policy mpr_read on public.member_payment_records
  for select using (true);

-- Only Edge Functions (service role, bypasses RLS) or the member themselves can insert
drop policy if exists mpr_insert on public.member_payment_records;
create policy mpr_insert on public.member_payment_records
  for insert with check (
    exists (select 1 from public.clubs c
            where c.id = member_payment_records.club_id and c.owner_id = auth.uid())
  );

-- No direct UPDATE from frontend — only via confirm_member_payment RPC
drop policy if exists mpr_no_update on public.member_payment_records;
create policy mpr_no_update on public.member_payment_records
  for update using (false);

-- ---------------------------------------------------------------------
-- 8. Realtime — add new tables to publication
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and tablename='payment_collections') then
    alter publication supabase_realtime add table public.payment_collections;
  end if;
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and tablename='member_payment_records') then
    alter publication supabase_realtime add table public.member_payment_records;
  end if;
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and tablename='fund_transactions') then
    alter publication supabase_realtime add table public.fund_transactions;
  end if;
end $$;

-- Done. ✅
-- Next steps (manual):
--   1. Run reconciliation check (see header comment)
--   2. Set up PayOS account → get clientId, apiKey, checksumKey
--   3. Deploy Edge Functions: create-payment, payos-webhook
--   4. Set Edge Function secrets: PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY
--   5. Register webhook URL in PayOS dashboard: {SUPABASE_URL}/functions/v1/payos-webhook
