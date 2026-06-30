-- payment_groups: one PayOS order that covers multiple member_payment_records
create table if not exists payment_groups (
  id                 uuid primary key default gen_random_uuid(),
  club_id            uuid not null references clubs(id) on delete cascade,
  collection_id      uuid not null references payment_collections(id) on delete cascade,
  payos_order_code   bigint unique,
  payos_checkout_url text,
  payos_qr_code      text,
  total_amount       int not null,
  status             text not null default 'pending' check (status in ('pending', 'paid')),
  created_at         timestamptz not null default now()
);

-- junction: which member_payment_records belong to a group
create table if not exists payment_group_members (
  group_id  uuid not null references payment_groups(id) on delete cascade,
  record_id uuid not null references member_payment_records(id) on delete cascade,
  primary key (group_id, record_id)
);

alter table payment_groups        enable row level security;
alter table payment_group_members enable row level security;

-- Everyone can read (public pay page, dashboard)
create policy "payment_groups_select"        on payment_groups        for select using (true);
create policy "payment_group_members_select" on payment_group_members for select using (true);

-- Only authenticated users can create groups; Edge Functions use service role (bypasses RLS)
create policy "payment_groups_insert"        on payment_groups        for insert with check (auth.role() = 'authenticated');
create policy "payment_group_members_insert" on payment_group_members for insert with check (auth.role() = 'authenticated');

-- Atomically confirm every member_payment_record in a group
create or replace function confirm_payment_group(
  p_group_id     uuid,
  p_confirmed_by text,
  p_user_id      uuid default null
)
returns void
language plpgsql
security definer
as $$
declare
  v_record_id uuid;
begin
  -- Row lock prevents duplicate confirms
  perform id from payment_groups where id = p_group_id for update;

  -- Idempotent: if already paid, nothing to do
  if (select status from payment_groups where id = p_group_id) = 'paid' then
    return;
  end if;

  update payment_groups set status = 'paid' where id = p_group_id;

  for v_record_id in
    select record_id from payment_group_members where group_id = p_group_id
  loop
    perform confirm_member_payment(v_record_id, p_confirmed_by, p_user_id);
  end loop;
end;
$$;
