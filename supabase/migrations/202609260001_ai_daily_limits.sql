-- Per-user daily AI limits (2026-09-26): standard and deep each get their own
-- daily quota per member; the shared monthly budget mechanism is removed.
-- Usage cost is still recorded for the owner's accounting, but never enforced.

alter table public.ai_usage_events add column if not exists used_on date;

-- Backfill the Shanghai calendar day for any rows written before this column.
update public.ai_usage_events
   set used_on = (created_at at time zone 'Asia/Shanghai')::date
 where used_on is null;

create index if not exists ai_usage_events_user_day_mode_idx
  on public.ai_usage_events (user_id, used_on, mode);

-- Stale pending reservations no longer refund deep_reading_daily (table is
-- being dropped below); marking them failed removes them from daily counts.
create or replace function public.cleanup_stale_ai_reservations()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ai_usage_events
     set actual_cost_micro_yuan = reserved_cost_micro_yuan,
         state = 'failed',
         settled_at = now()
   where state = 'pending'
     and created_at < pg_catalog.now() - interval '5 minutes';
$$;

drop function if exists public.reserve_ai_request(uuid, uuid, date, date, text, bigint, bigint);

-- Count-based reservation: pending+succeeded events count against the quota,
-- failed ones (upstream errors, client aborts, stale cleanups) auto-refund.
create or replace function public.reserve_ai_request(
  p_user_id uuid,
  p_request_id uuid,
  p_day date,
  p_month date,
  p_mode text,
  p_standard_limit integer,
  p_deep_limit integer,
  p_reserved_cost_micro_yuan bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  used_count integer;
  daily_limit integer;
begin
  perform public.cleanup_stale_ai_reservations();
  if p_mode not in ('standard', 'deep')
     or p_standard_limit < 1
     or p_deep_limit < 1
     or p_reserved_cost_micro_yuan < 0 then
    return pg_catalog.jsonb_build_object('reserved', false, 'reason', 'invalid_request');
  end if;
  if not exists (select 1 from public.beta_members where user_id = p_user_id) then
    return pg_catalog.jsonb_build_object('reserved', false, 'reason', 'not_invited');
  end if;

  daily_limit := case when p_mode = 'deep' then p_deep_limit else p_standard_limit end;

  -- Serializes per-user per-day reservations, so parallel requests cannot all
  -- pass against the same remaining quota.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_user_id::text || ':' || p_day::text)
  );

  select pg_catalog.count(*) into used_count
    from public.ai_usage_events
   where user_id = p_user_id
     and used_on = p_day
     and mode = p_mode
     and state in ('pending', 'succeeded');

  if used_count >= daily_limit then
    return pg_catalog.jsonb_build_object('reserved', false, 'reason', 'daily_limit');
  end if;

  insert into public.ai_usage_events (
    request_id, user_id, usage_month, used_on, mode, reserved_cost_micro_yuan
  ) values (
    p_request_id, p_user_id, p_month, p_day, p_mode, p_reserved_cost_micro_yuan
  );
  return pg_catalog.jsonb_build_object('reserved', true);
end;
$$;

drop table if exists public.deep_reading_daily;

revoke all on function public.cleanup_stale_ai_reservations() from public, anon, authenticated;
grant execute on function public.cleanup_stale_ai_reservations() to service_role;
revoke all on function public.reserve_ai_request(uuid, uuid, date, date, text, integer, integer, bigint) from public, anon, authenticated;
grant execute on function public.reserve_ai_request(uuid, uuid, date, date, text, integer, integer, bigint) to service_role;
