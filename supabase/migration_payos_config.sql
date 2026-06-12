-- =====================================================================
--  FEETAP — Migration: PayOS per-club config (multi-tenant)
--
--  Mỗi club host tự nhập PayOS keys của họ → tiền member đóng đi
--  thẳng vào tài khoản ngân hàng của host đó.
--  Tính năng chỉ dành cho Pro plan.
--
--  Bảng này có RLS nghiêm: chỉ club owner mới đọc được keys —
--  members và các club khác hoàn toàn không thấy.
-- =====================================================================

create table if not exists public.club_payment_config (
  club_id           uuid primary key references public.clubs(id) on delete cascade,
  payos_client_id   text not null,
  payos_api_key     text not null,
  payos_checksum_key text not null,
  webhook_configured boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Keep updated_at fresh
create or replace function public.set_payment_config_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_payment_config_updated_at on public.club_payment_config;
create trigger trg_payment_config_updated_at
  before update on public.club_payment_config
  for each row execute function public.set_payment_config_updated_at();

-- ── RLS: chỉ owner đọc và ghi — members không thấy keys ──────────────
alter table public.club_payment_config enable row level security;

drop policy if exists payos_config_owner_all on public.club_payment_config;
create policy payos_config_owner_all on public.club_payment_config for all
  using (
    exists (select 1 from public.clubs c
            where c.id = club_payment_config.club_id and c.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.clubs c
            where c.id = club_payment_config.club_id and c.owner_id = auth.uid())
  );

-- Done. ✅
