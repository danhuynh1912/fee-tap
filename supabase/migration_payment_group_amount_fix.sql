-- Fix: confirm_payment_group now accepts the actual PayOS total so each
-- member_payment_records row is updated to the real per-member amount
-- before the fund transaction is written.
create or replace function confirm_payment_group(
  p_group_id      uuid,
  p_confirmed_by  text,
  p_user_id       uuid  default null,
  p_actual_total  int   default null  -- actual amount received from PayOS
)
returns void
language plpgsql
security definer
as $$
declare
  v_record_id        uuid;
  v_count            int;
  v_amount_per_record int;
begin
  -- Row lock prevents duplicate confirms
  perform id from payment_groups where id = p_group_id for update;

  -- Idempotent: if already paid, nothing to do
  if (select status from payment_groups where id = p_group_id) = 'paid' then
    return;
  end if;

  -- If we know the actual PayOS amount, distribute it evenly across records
  -- so fund_transactions reflect what was truly transferred.
  if p_actual_total is not null then
    select count(*) into v_count
    from payment_group_members where group_id = p_group_id;

    if v_count > 0 then
      v_amount_per_record := p_actual_total / v_count;
      update member_payment_records
      set amount = v_amount_per_record
      where id in (
        select record_id from payment_group_members where group_id = p_group_id
      );
    end if;
  end if;

  update payment_groups set status = 'paid' where id = p_group_id;

  for v_record_id in
    select record_id from payment_group_members where group_id = p_group_id
  loop
    perform confirm_member_payment(v_record_id, p_confirmed_by, p_user_id);
  end loop;
end;
$$;
