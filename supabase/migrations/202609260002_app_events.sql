-- Anonymous product analytics (2026-09-26): page views and feature usage only,
-- never reading content or questions. Rows are written by the /api/log function
-- (service role, event-name allowlist) for signed-in beta members; the table is
-- fully closed to client roles and read only by the owner dashboard endpoint.
create table if not exists public.app_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  path text
);

alter table public.app_events enable row level security;

revoke all on public.app_events from anon, authenticated;

create index if not exists app_events_created_idx on public.app_events (created_at desc);
