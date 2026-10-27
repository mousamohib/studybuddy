-- Admin dashboard: app-wide settings the admin can change, Pro given by an admin, report status and an audit log.
-- Who is an admin is NOT stored here: it's the ADMIN_EMAILS secret on the server (see README).

-- One row of settings. Only the server (service role) reads or writes it; no app access.
create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  ai_paused boolean not null default false,
  ai_budget_usd numeric(10,2) not null default 24,     -- total AI spend per month across everyone
  free_cap_usd numeric(10,2) not null default 0.5,     -- AI spend per free user per month
  pro_cap_usd numeric(10,2) not null default 8,        -- AI spend per Pro user per month
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;
alter table public.app_settings enable row level security;

-- Pro given for free by an admin (testers, friends), so it isn't counted as revenue.
alter table public.subscriptions add column if not exists granted_by_admin boolean not null default false;

-- Reports on AI answers can be marked as dealt with.
alter table public.reports add column if not exists resolved_at timestamptz;

-- Every admin action, newest first in the dashboard.
create table if not exists public.admin_actions (
  id bigint generated always as identity primary key,
  admin_email text not null,
  action text not null,
  target text,
  detail jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_actions enable row level security;

create or replace function public.schema_version() returns int language sql stable as $$ select 5 $$;
grant execute on function public.schema_version() to anon, authenticated;
