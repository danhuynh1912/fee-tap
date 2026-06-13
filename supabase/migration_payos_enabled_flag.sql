-- =====================================================================
--  FEETAP — Migration: club_has_payos() RPC function
--
--  Members cannot read club_payment_config (RLS protects API keys).
--  This SECURITY DEFINER function bypasses RLS to return a simple
--  boolean — safe to call by any authenticated user.
-- =====================================================================

create or replace function public.club_has_payos(p_club_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists(
    select 1 from public.club_payment_config where club_id = p_club_id
  );
$$;
