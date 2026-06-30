-- Vote hộ cố định: marks a club member as having a permanent proxy delegation.
-- When proxy_delegate = true, the club owner can vote for this member
-- with a single "Vote all fixed" button across all future votes.

alter table public.club_members
  add column if not exists proxy_delegate boolean not null default false;
