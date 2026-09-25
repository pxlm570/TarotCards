-- Closed beta access, one deep reading per Shanghai calendar day, and a shared
-- monthly AI budget. Invite codes are stored only as SHA-256 hashes.

create table if not exists public.beta_invite_codes (
  code_hash text primary key check (code_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_by uuid unique,
  redeemed_at timestamptz
);

create table if not exists public.beta_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  invite_code_hash text not null unique references public.beta_invite_codes(code_hash),
  created_at timestamptz not null default now()
);

create table if not exists public.deep_reading_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  used_on date not null,
  request_id uuid not null unique,
  created_at timestamptz not null default now(),
  primary key (user_id, used_on)
);

create table if not exists public.ai_usage_events (
  request_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_month date not null,
  mode text not null check (mode in ('standard', 'deep')),
  reserved_cost_micro_yuan bigint not null check (reserved_cost_micro_yuan >= 0),
  actual_cost_micro_yuan bigint,
  state text not null default 'pending' check (state in ('pending', 'succeeded', 'failed')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create or replace function public.cleanup_stale_ai_reservations()
returns void
language sql
security definer
set search_path = ''
as $$
  with stale as (
    update public.ai_usage_events
       set actual_cost_micro_yuan = reserved_cost_micro_yuan,
           state = 'failed',
           settled_at = now()
     where state = 'pending'
       and created_at < pg_catalog.now() - interval '5 minutes'
     returning request_id
  )
  delete from public.deep_reading_daily
   where request_id in (select request_id from stale);
$$;

alter table public.beta_invite_codes enable row level security;
alter table public.beta_members enable row level security;
alter table public.deep_reading_daily enable row level security;
alter table public.ai_usage_events enable row level security;

drop policy if exists "members read own access" on public.beta_members;
create policy "members read own access" on public.beta_members
  for select to authenticated using (auth.uid() = user_id);

revoke all on public.beta_invite_codes from anon, authenticated;
revoke all on public.deep_reading_daily from anon, authenticated;
revoke all on public.ai_usage_events from anon, authenticated;
revoke insert, update, delete on public.beta_members from anon, authenticated;
grant select on public.beta_members to authenticated;

create or replace function public.redeem_beta_invite(p_user_id uuid, p_code_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_hash text;
begin
  if p_user_id is null or p_code_hash !~ '^[0-9a-f]{64}$' then
    return pg_catalog.jsonb_build_object('redeemed', false);
  end if;

  if exists (select 1 from public.beta_members where user_id = p_user_id) then
    return pg_catalog.jsonb_build_object('redeemed', true, 'already_member', true);
  end if;

  update public.beta_invite_codes
     set redeemed_by = p_user_id, redeemed_at = pg_catalog.now()
   where code_hash = p_code_hash
     and redeemed_by is null
     and expires_at > pg_catalog.now()
   returning code_hash into claimed_hash;

  if claimed_hash is null then
    return pg_catalog.jsonb_build_object('redeemed', false);
  end if;

  insert into public.beta_members (user_id, invite_code_hash)
  values (p_user_id, claimed_hash);
  return pg_catalog.jsonb_build_object('redeemed', true);
end;
$$;

create or replace function public.reserve_ai_request(
  p_user_id uuid,
  p_request_id uuid,
  p_day date,
  p_month date,
  p_mode text,
  p_estimated_cost_micro_yuan bigint,
  p_budget_micro_yuan bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  month_reserved bigint;
begin
  perform public.cleanup_stale_ai_reservations();
  if p_mode not in ('standard', 'deep') or p_estimated_cost_micro_yuan < 0 then
    return pg_catalog.jsonb_build_object('reserved', false, 'reason', 'invalid_request');
  end if;
  if not exists (select 1 from public.beta_members where user_id = p_user_id) then
    return pg_catalog.jsonb_build_object('reserved', false, 'reason', 'not_invited');
  end if;

  -- Serializes budget reservations for the month, so parallel users cannot all
  -- pass against the same remaining balance.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_month::text));
  select coalesce(sum(case
    when state = 'pending' then reserved_cost_micro_yuan
    else coalesce(actual_cost_micro_yuan, 0)
  end), 0)
    into month_reserved
    from public.ai_usage_events
   where usage_month = p_month;

  if month_reserved + p_estimated_cost_micro_yuan > p_budget_micro_yuan then
    return pg_catalog.jsonb_build_object('reserved', false, 'reason', 'monthly_budget');
  end if;

  if p_mode = 'deep' then
    insert into public.deep_reading_daily (user_id, used_on, request_id)
    values (p_user_id, p_day, p_request_id)
    on conflict (user_id, used_on) do nothing;
    if not found then
      return pg_catalog.jsonb_build_object('reserved', false, 'reason', 'daily_limit');
    end if;
  end if;

  insert into public.ai_usage_events (
    request_id, user_id, usage_month, mode, reserved_cost_micro_yuan
  ) values (
    p_request_id, p_user_id, p_month, p_mode, p_estimated_cost_micro_yuan
  );
  return pg_catalog.jsonb_build_object('reserved', true);
end;
$$;

create or replace function public.settle_ai_request(
  p_request_id uuid,
  p_actual_cost_micro_yuan bigint,
  p_succeeded boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  settled_user uuid;
begin
  update public.ai_usage_events
     set actual_cost_micro_yuan = greatest(0, p_actual_cost_micro_yuan),
         state = case when p_succeeded then 'succeeded' else 'failed' end,
         settled_at = pg_catalog.now()
   where request_id = p_request_id
     and state = 'pending'
   returning user_id into settled_user;

  if settled_user is not null and not p_succeeded then
    delete from public.deep_reading_daily
     where request_id = p_request_id and user_id = settled_user;
  end if;
end;
$$;

revoke all on function public.redeem_beta_invite(uuid, text) from public, anon;
grant execute on function public.redeem_beta_invite(uuid, text) to service_role;
revoke all on function public.cleanup_stale_ai_reservations() from public, anon, authenticated;
grant execute on function public.cleanup_stale_ai_reservations() to service_role;
revoke all on function public.reserve_ai_request(uuid, uuid, date, date, text, bigint, bigint) from public, anon, authenticated;
grant execute on function public.reserve_ai_request(uuid, uuid, date, date, text, bigint, bigint) to service_role;
revoke all on function public.settle_ai_request(uuid, bigint, boolean) from public, anon, authenticated;
grant execute on function public.settle_ai_request(uuid, bigint, boolean) to service_role;
