-- =====================================================================
--  FEETAP — Telegram Integration Migration
--
--  Run after schema.sql and all previous migrations.
--
--  Creates:
--    • telegram_links         — maps telegram_id ↔ auth user (for admin)
--    • telegram_club_configs  — maps Telegram group_chat_id to a club
--    • link_tokens            — one-time tokens for reverse-flow linking
--  Extends:
--    • responses.voted_via    — tracks which surface a vote came from
--    • club_members.telegram_id — optional per-member Telegram link
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TELEGRAM_LINKS — admin (Google user) ↔ Telegram account
-- ---------------------------------------------------------------------
create table if not exists public.telegram_links (
  telegram_id   bigint      primary key,
  user_id       uuid        not null references auth.users(id) on delete cascade,
  telegram_name text,                                -- display name from Telegram
  linked_at     timestamptz not null default now()
);

-- Index so we can quickly look up by user_id (e.g. "is this user linked?")
create index if not exists telegram_links_user_id_idx on public.telegram_links (user_id);

-- RLS: a user can only see/manage their own link
alter table public.telegram_links enable row level security;

drop policy if exists tg_links_self on public.telegram_links;
create policy tg_links_self on public.telegram_links
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 2. LINK_TOKENS — short-lived tokens for the reverse linking flow
--    Flow: user sends /link to bot → bot generates code → user enters
--    in web app → web app validates and creates telegram_links row.
-- ---------------------------------------------------------------------
create table if not exists public.link_tokens (
  token       text        primary key default upper(substring(gen_random_uuid()::text, 1, 3) || '-' || substring(gen_random_uuid()::text, 1, 3)),
  telegram_id bigint      not null,
  telegram_name text,
  expires_at  timestamptz not null default (now() + interval '10 minutes'),
  used        boolean     not null default false
);

-- Auto-clean expired tokens (call periodically or via pg_cron)
create or replace function public.cleanup_link_tokens()
returns void language sql as $$
  delete from public.link_tokens where expires_at < now() or used = true;
$$;

-- No RLS needed — only accessible via service_role (Edge Functions)
-- Anon/authenticated users should NOT be able to read raw tokens

-- ---------------------------------------------------------------------
-- 3. TELEGRAM_CLUB_CONFIGS — which Telegram group belongs to which club
-- ---------------------------------------------------------------------
create table if not exists public.telegram_club_configs (
  club_id       uuid    primary key references public.clubs(id) on delete cascade,
  group_chat_id bigint  not null unique,  -- Telegram group/supergroup chat ID
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Index for the hot path: lookup club by group_chat_id (every bot update)
create index if not exists tg_club_cfg_chat_idx on public.telegram_club_configs (group_chat_id);

-- RLS: only club owner can manage their config
alter table public.telegram_club_configs enable row level security;

drop policy if exists tg_club_cfg_owner on public.telegram_club_configs;
create policy tg_club_cfg_owner on public.telegram_club_configs
  using      (exists (select 1 from public.clubs c where c.id = club_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from public.clubs c where c.id = club_id and c.owner_id = auth.uid()));

-- Members can read (so web app can show "Telegram connected" badge)
drop policy if exists tg_club_cfg_read on public.telegram_club_configs;
create policy tg_club_cfg_read on public.telegram_club_configs
  for select using (true);

-- ---------------------------------------------------------------------
-- 4. EXTEND RESPONSES — track which surface the vote came from
-- ---------------------------------------------------------------------
alter table public.responses
  add column if not exists voted_via text not null default 'web'
    check (voted_via in ('web', 'telegram'));

-- ---------------------------------------------------------------------
-- 5. EXTEND CLUB_MEMBERS — optional Telegram ID per member
--    Allows "remember me" in Mini App: maps telegram_id → member row
-- ---------------------------------------------------------------------
alter table public.club_members
  add column if not exists telegram_id bigint references public.telegram_links(telegram_id) on delete set null;

create index if not exists club_members_telegram_idx on public.club_members (telegram_id)
  where telegram_id is not null;

-- ---------------------------------------------------------------------
-- 6. RPC: resolve_telegram_member
--    Called from Mini App to check if a telegram_id is linked to a member
--    Returns: { member_id, member_name } or null
-- ---------------------------------------------------------------------
create or replace function public.resolve_telegram_member(
  p_telegram_id bigint,
  p_club_id     uuid
)
returns table (member_id uuid, member_name text)
language sql security definer as $$
  select m.id, m.name
  from   public.club_members m
  where  m.club_id     = p_club_id
    and  m.telegram_id = p_telegram_id
  limit 1;
$$;

-- ---------------------------------------------------------------------
-- 7. RPC: consume_link_token
--    Called from web app (authenticated user) to finalize Telegram link.
--    Validates token, creates telegram_links row, marks token used.
-- ---------------------------------------------------------------------
create or replace function public.consume_link_token(
  p_token text
)
returns jsonb
language plpgsql security definer as $$
declare
  v_token  public.link_tokens%rowtype;
  v_uid    uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into v_token
  from   public.link_tokens
  where  token = upper(p_token)
    and  used = false
    and  expires_at > now()
  for update skip locked;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_or_expired_token');
  end if;

  -- Mark token consumed first (prevent race conditions)
  update public.link_tokens set used = true where token = v_token.token;

  -- Upsert the link (user may re-link after unlinking)
  insert into public.telegram_links (telegram_id, user_id, telegram_name)
  values (v_token.telegram_id, v_uid, v_token.telegram_name)
  on conflict (telegram_id) do update
    set user_id       = excluded.user_id,
        telegram_name = excluded.telegram_name,
        linked_at     = now();

  return jsonb_build_object('ok', true, 'telegram_name', v_token.telegram_name);
end;
$$;
