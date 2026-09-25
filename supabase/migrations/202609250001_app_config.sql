-- Unified LLM provider configuration (2026-09-25). Values are written only by
-- the owner via `npm run ai:config` from a local machine with the service role
-- key; RLS has no policies and client roles have no grants, so visitors and
-- signed-in members can never read the endpoint, model names, or the API key.
create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;

revoke all on public.app_config from anon, authenticated;
