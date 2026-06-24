-- Add fixed-count fee split mode support
alter table club_settings
  add column if not exists fee_split_fixed_count smallint default null;

alter table club_settings
  drop constraint if exists club_settings_fee_split_mode_check;

alter table club_settings
  add constraint club_settings_fee_split_mode_check
  check (fee_split_mode in ('committed_only', 'total_members', 'fixed_count'));
