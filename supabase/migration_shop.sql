-- =====================================================================
--  FEETAP — Migration: Shop Portal (CLB ↔ Shop marketplace)
--
--  Biến FeeTap thành nền tảng trung gian giữa CLB cầu lông và Shop cầu.
--  Shop liên kết tới các CLB ruột → theo dõi tồn kho cầu, lịch đánh,
--  burn rate, và chủ động giao hàng.
--
--  Nguyên tắc kiến trúc (SSOT / DRY / SOLID):
--    • shuttle_transactions ledger vẫn là SSOT DUY NHẤT của tồn kho.
--      Migration này KHÔNG tạo bảng inventory snapshot riêng.
--    • Thuật toán tính tồn kho (computeShuttleStock) sống DUY NHẤT trong
--      JS (src/engine/forecast.js). RPC bên dưới CHỈ là ranh giới
--      access-control + batching — trả raw rows đã scope theo CLB liên
--      kết, KHÔNG re-implement thuật toán trong PL/pgSQL.
--    • Ngưỡng cảnh báo sắp hết cầu là CLB-configurable, lưu trong
--      club_settings (nơi tập trung mọi config của CLB).
--
--  Idempotent — safe to re-run. Chạy SAU supabase/schema.sql.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 0. EXTEND club_settings — ngưỡng cảnh báo sắp hết cầu (số buổi)
-- ---------------------------------------------------------------------
alter table public.club_settings
  add column if not exists shuttle_low_stock_sessions numeric not null default 1;

-- ---------------------------------------------------------------------
-- 0b. EXTEND shuttle_transactions — thêm source 'delivery'
--     (lô hàng shop giao, được CLB xác nhận → cộng vào ledger SSOT)
-- ---------------------------------------------------------------------
alter table public.shuttle_transactions
  drop constraint if exists shuttle_transactions_source_check;
alter table public.shuttle_transactions
  add constraint shuttle_transactions_source_check
  check (source in ('restock','session_log','estimated','adjustment','opening','delivery'));

alter table public.shuttle_transactions
  add column if not exists delivery_id uuid;  -- liên kết tới shuttle_deliveries (set sau)

-- ---------------------------------------------------------------------
-- 1. user_profiles — phân loại tài khoản: club host hoặc shop owner
-- ---------------------------------------------------------------------
create table if not exists public.user_profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  profile_type text not null check (profile_type in ('club','shop')),
  created_at   timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

drop policy if exists user_profiles_self on public.user_profiles;
create policy user_profiles_self on public.user_profiles for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 2. shops — thông tin cửa hàng cầu lông
-- ---------------------------------------------------------------------
create table if not exists public.shops (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  phone      text,
  address    text,
  created_at timestamptz not null default now()
);

create index if not exists shops_owner_idx on public.shops(owner_id);

alter table public.shops enable row level security;

-- Owner: full access tới shop của mình.
drop policy if exists shops_owner_all on public.shops;
create policy shops_owner_all on public.shops for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- NOTE: policy "shops_linked_club_read" (CLB host đọc shop đối tác) được tạo
-- ở SAU phần 3, vì nó tham chiếu bảng shop_club_links chưa tồn tại tại đây.

-- ---------------------------------------------------------------------
-- 3. shop_club_links — liên kết CLB ↔ Shop (1 CLB : 1 Shop)
-- ---------------------------------------------------------------------
create table if not exists public.shop_club_links (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references public.shops(id) on delete cascade,
  club_id      uuid not null references public.clubs(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending','active','rejected')),
  initiated_by text not null check (initiated_by in ('shop','club')),
  created_at   timestamptz not null default now(),
  linked_at    timestamptz
  -- Quy tắc "1 CLB : 1 shop" enforced bằng partial unique index bên dưới
  -- (chỉ tính status active/pending — cho phép nhiều bản ghi 'rejected').
);

create index if not exists shop_club_links_shop_idx on public.shop_club_links(shop_id, status);
create index if not exists shop_club_links_club_idx on public.shop_club_links(club_id, status);

-- Đảm bảo 1 CLB chỉ có TỐI ĐA 1 link active/pending (không tính rejected).
create unique index if not exists shop_club_links_one_active_per_club
  on public.shop_club_links(club_id)
  where status in ('pending','active');

-- Helper: kiểm tra ownership shop mà KHÔNG qua RLS (security definer).
-- Dùng trong các policy của shop_club_links để phá vòng lặp đệ quy:
--   shops RLS → shop_club_links → shops RLS → ∞
create or replace function public.auth_uid_owns_shop(p_shop_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(select 1 from public.shops where id = p_shop_id and owner_id = auth.uid());
$$;

alter table public.shop_club_links enable row level security;

-- Cả shop owner lẫn club host của link đều thấy/sửa được.
-- Dùng auth_uid_owns_shop() thay vì subquery trực tiếp vào shops để tránh circular RLS.
drop policy if exists shop_club_links_party_select on public.shop_club_links;
create policy shop_club_links_party_select on public.shop_club_links for select
  using (
    public.auth_uid_owns_shop(shop_id)
    or club_id in (select id from public.clubs where owner_id = auth.uid())
  );

drop policy if exists shop_club_links_party_insert on public.shop_club_links;
create policy shop_club_links_party_insert on public.shop_club_links for insert
  with check (
    public.auth_uid_owns_shop(shop_id)
    or club_id in (select id from public.clubs where owner_id = auth.uid())
  );

drop policy if exists shop_club_links_party_update on public.shop_club_links;
create policy shop_club_links_party_update on public.shop_club_links for update
  using (
    public.auth_uid_owns_shop(shop_id)
    or club_id in (select id from public.clubs where owner_id = auth.uid())
  );

drop policy if exists shop_club_links_party_delete on public.shop_club_links;
create policy shop_club_links_party_delete on public.shop_club_links for delete
  using (
    public.auth_uid_owns_shop(shop_id)
    or club_id in (select id from public.clubs where owner_id = auth.uid())
  );

-- CLB host được đọc tên shop đối tác (shop có link với CLB của họ).
-- Đặt ở đây vì tham chiếu shop_club_links vừa tạo xong.
drop policy if exists shops_linked_club_read on public.shops;
create policy shops_linked_club_read on public.shops for select
  using (
    exists (
      select 1 from public.shop_club_links lnk
      join public.clubs c on c.id = lnk.club_id
      where lnk.shop_id = shops.id and c.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- 4. shuttle_deliveries — staging + audit log lô hàng shop giao
--     KHÔNG phải SSOT tồn kho. Khi CLB xác nhận → insert vào
--     shuttle_transactions (ledger SSOT) qua confirm_shuttle_delivery().
-- ---------------------------------------------------------------------
create table if not exists public.shuttle_deliveries (
  id                uuid primary key default gen_random_uuid(),
  shop_id           uuid not null references public.shops(id) on delete cascade,
  club_id           uuid not null references public.clubs(id) on delete cascade,
  boxes             numeric not null check (boxes > 0),
  note              text,        -- ghi chú tự do (tên cầu, giá... — Phương án A)
  delivered_at      timestamptz not null default now(),
  confirmed_by_club boolean not null default false,
  confirmed_at      timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists shuttle_deliveries_club_idx on public.shuttle_deliveries(club_id, delivered_at desc);
create index if not exists shuttle_deliveries_shop_idx on public.shuttle_deliveries(shop_id, delivered_at desc);

-- Liên kết delivery_id (đã thêm ở phần 0b) tới bảng vừa tạo.
do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'shuttle_transactions_delivery_fk'
  ) then
    alter table public.shuttle_transactions
      add constraint shuttle_transactions_delivery_fk
      foreign key (delivery_id) references public.shuttle_deliveries(id) on delete set null;
  end if;
end $$;

alter table public.shuttle_deliveries enable row level security;

-- Shop owner: full access tới delivery của shop mình, nhưng chỉ tới CLB đã link active.
drop policy if exists shuttle_deliveries_shop_all on public.shuttle_deliveries;
create policy shuttle_deliveries_shop_all on public.shuttle_deliveries for all
  using (shop_id in (select id from public.shops where owner_id = auth.uid()))
  with check (
    shop_id in (select id from public.shops where owner_id = auth.uid())
    and exists (
      select 1 from public.shop_club_links lnk
      where lnk.shop_id = shuttle_deliveries.shop_id
        and lnk.club_id = shuttle_deliveries.club_id
        and lnk.status = 'active'
    )
  );

-- CLB host: đọc delivery tới CLB mình (để xác nhận). Update qua RPC (security definer).
drop policy if exists shuttle_deliveries_club_read on public.shuttle_deliveries;
create policy shuttle_deliveries_club_read on public.shuttle_deliveries for select
  using (club_id in (select id from public.clubs where owner_id = auth.uid()));

-- ---------------------------------------------------------------------
-- 5. RPC: confirm_shuttle_delivery — CLB xác nhận nhận hàng (atomic)
--     Ledger SSOT: insert 1 transaction source='delivery' + mark confirmed.
-- ---------------------------------------------------------------------
create or replace function public.confirm_shuttle_delivery(p_delivery_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
begin
  select * into d from public.shuttle_deliveries where id = p_delivery_id;
  if not found then
    raise exception 'delivery not found';
  end if;

  -- Chỉ host của CLB nhận hàng mới được xác nhận.
  if not exists (select 1 from public.clubs where id = d.club_id and owner_id = auth.uid()) then
    raise exception 'not authorized';
  end if;

  -- Idempotent: đã xác nhận thì bỏ qua.
  if d.confirmed_by_club then
    return;
  end if;

  -- Cộng vào ledger SSOT (boxes → balls).
  insert into public.shuttle_transactions (club_id, delta, source, note, delivery_id, created_at)
  values (d.club_id, (d.boxes * 12)::int, 'delivery', d.note, d.id, now());

  update public.shuttle_deliveries
    set confirmed_by_club = true, confirmed_at = now()
    where id = d.id;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. RPC: get_shop_clubs_data — batch fetch cho shop dashboard
--     1 round trip (chống N+1). Trả raw rows ĐÃ scope theo CLB liên kết
--     active, ĐÃ loại bỏ field tài chính (chỉ cầu, không tiền).
--     Thuật toán tồn kho chạy phía JS (computeShuttleStock) trên dữ liệu này.
-- ---------------------------------------------------------------------
create or replace function public.get_shop_clubs_data(p_shop_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  -- Authz: caller phải là chủ shop.
  if not exists (select 1 from public.shops where id = p_shop_id and owner_id = auth.uid()) then
    raise exception 'not authorized';
  end if;

  select coalesce(jsonb_agg(club_obj), '[]'::jsonb) into result
  from (
    select jsonb_build_object(
      'club', jsonb_build_object('id', c.id, 'name', c.name, 'sport_type', c.sport_type),
      'link', jsonb_build_object('id', lnk.id, 'linked_at', lnk.linked_at),
      -- chỉ field liên quan tồn kho cầu — KHÔNG current_fund / giá (privacy)
      'settings', jsonb_build_object(
        'estimated_shuttlecocks', cs.estimated_shuttlecocks,
        'shuttle_low_stock_sessions', cs.shuttle_low_stock_sessions
      ),
      'slots', coalesce((
        select jsonb_agg(jsonb_build_object(
          'name', s.name, 'venue_name', s.venue_name,
          'weekdays', s.weekdays, 'hours_per_session', s.hours_per_session
        ))
        from public.court_slots s where s.club_id = c.id
      ), '[]'::jsonb),
      'shuttleTxns', coalesce((
        select jsonb_agg(jsonb_build_object(
          'delta', t.delta, 'source', t.source,
          'session_date', t.session_date, 'created_at', t.created_at
        ))
        from public.shuttle_transactions t where t.club_id = c.id
      ), '[]'::jsonb),
      'logs', coalesce((
        select jsonb_agg(jsonb_build_object('played_on', l.played_on, 'actual_shuttlecocks', l.actual_shuttlecocks))
        from public.session_logs l where l.club_id = c.id
      ), '[]'::jsonb),
      'deliveries', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', dv.id, 'boxes', dv.boxes, 'note', dv.note,
          'delivered_at', dv.delivered_at, 'confirmed_by_club', dv.confirmed_by_club
        ) order by dv.delivered_at desc)
        from public.shuttle_deliveries dv where dv.club_id = c.id and dv.shop_id = p_shop_id
      ), '[]'::jsonb)
    ) as club_obj
    from public.shop_club_links lnk
    join public.clubs c on c.id = lnk.club_id
    left join public.club_settings cs on cs.club_id = c.id
    where lnk.shop_id = p_shop_id and lnk.status = 'active'
    order by c.name
  ) sub;

  return result;
end;
$$;

-- ---------------------------------------------------------------------
-- 7a. RPC: get_shop_by_code — CLB tra cứu shop theo partner code (UUID).
--      SECURITY DEFINER để bypass RLS (CLB chưa link không đọc được shops).
--      Chỉ trả id + name (không có thông tin tài chính / nhạy cảm).
-- ---------------------------------------------------------------------
create or replace function public.get_shop_by_code(p_shop_id uuid)
returns table (id uuid, name text, phone text)
language sql
security definer
stable
set search_path = public
as $$
  select s.id, s.name, s.phone
  from public.shops s
  where s.id = p_shop_id
  limit 1;
$$;

-- ---------------------------------------------------------------------
-- 7. RPC: search_shops — CLB host tìm shop để gửi lời mời liên kết.
--     RLS trên `shops` chỉ cho CLB đọc shop ĐÃ liên kết, nên cần RPC này
--     để khám phá shop mới. Chỉ trả field công khai (id, name, phone).
-- ---------------------------------------------------------------------
create or replace function public.search_shops(p_query text)
returns table (id uuid, name text, phone text)
language sql
security definer
set search_path = public
as $$
  select s.id, s.name, s.phone
  from public.shops s
  where p_query is not null
    and length(btrim(p_query)) >= 2
    and s.name ilike '%' || btrim(p_query) || '%'
  order by s.name
  limit 10;
$$;

-- Done. ✅
