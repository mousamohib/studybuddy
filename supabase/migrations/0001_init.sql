-- StudyBuddy: initial schema (step 1 of the build plan)
-- Run this whole file once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Every table belongs to one user and Row Level Security stops anyone else reading it.

create extension if not exists pgcrypto;

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  school text,
  country text check (country in ('CA','GB') or country is null),
  age_confirmed boolean not null default false,
  teaching_style text not null default 'simple',      -- simple | exam | maths | lecture | quick | custom
  custom_rules text,
  integrity_mode boolean not null default false,       -- off by default (decision 13)
  timezone text default 'America/Toronto',
  study_hours jsonb not null default '{"Mon":3,"Tue":3,"Wed":3,"Thu":3,"Fri":3,"Sat":4,"Sun":4}',
  created_at timestamptz not null default now()
);

-- ---------- subscriptions (payments placeholder) ----------
-- The app only ever reads "plan". The payments work (RevenueCat / Stripe) later writes this table.
create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'trial' check (plan in ('free','trial','pro')),
  trial_ends_at timestamptz default (now() + interval '7 days'),
  renews_at timestamptz,
  provider text,               -- 'revenuecat' | 'stripe' | null
  provider_customer_id text,
  updated_at timestamptz not null default now()
);

-- ---------- usage (monthly counters) ----------
create table public.usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null,                       -- 'YYYY-MM'
  uploads int not null default 0,
  tutor_messages int not null default 0,
  weekly_sheets int not null default 0,
  exam_sheets int not null default 0,
  papers int not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  cost_usd numeric(10,4) not null default 0,
  primary key (user_id, month)
);

-- ---------- courses ----------
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  code text not null,
  name text,
  colour text,
  rules text,
  ai_policy text,
  teaching_style text,
  created_at timestamptz not null default now()
);

-- ---------- deadlines ----------
create table public.deadlines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  kind text not null check (kind in ('assignment','quiz','midterm','final','test','lab','project','other')),
  label text,
  due_at timestamptz not null,
  covers text,
  done boolean not null default false,
  calendar_event_id text,
  created_at timestamptz not null default now()
);

-- ---------- materials ----------
create table public.materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  deadline_id uuid references public.deadlines(id) on delete set null,  -- set = file belongs to an assignment
  file_name text not null,
  storage_path text,
  file_type text,
  size_bytes bigint,
  chars int,
  outline jsonb,
  status text not null default 'uploaded' check (status in ('uploaded','reading','outlining','ready','error')),
  created_at timestamptz not null default now()
);

create table public.material_chunks (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  n int not null,
  text text not null
);

-- ---------- plans ----------
create table public.plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  summary text,
  days jsonb not null default '[]',
  done jsonb not null default '{}',
  instructions jsonb not null default '[]',
  change_log jsonb not null default '[]',
  inputs_key text,
  generated_at timestamptz
);

-- ---------- chats ----------
create table public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,  -- null = General
  mode text not null default 'ask' check (mode in ('ask','lesson','practice','coding','assignment')),
  title text not null default 'New chat',
  style text,
  material_ids uuid[] not null default '{}',
  deadline_id uuid references public.deadlines(id) on delete set null,
  messages jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

-- ---------- memory and revisit list ----------
create table public.memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  kind text not null default 'fact' check (kind in ('fact','revisit')),
  text text not null,
  done boolean not null default false,
  source text not null default 'you',
  created_at timestamptz not null default now()
);

-- ---------- group project memory (v2; table ready now) ----------
create table public.project_briefs (
  deadline_id uuid primary key references public.deadlines(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  is_group boolean not null default false,
  role text,
  brief jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- ---------- documents (sheets and papers) ----------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  kind text not null check (kind in ('weekly_sheet','exam_sheet','derivation_sheet','paper')),
  title text,
  body text,
  meta jsonb not null default '{}',   -- coverage, question list, lecture key, skipped items...
  share_token text unique,
  created_at timestamptz not null default now()
);

-- ---------- background jobs ----------
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null,
  input jsonb not null default '{}',
  status text not null default 'queued' check (status in ('queued','running','done','error','cancelled')),
  progress int not null default 0,
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Row Level Security: owner-only access ----------
do $$
declare t text;
begin
  foreach t in array array['courses','deadlines','materials','material_chunks','chats','memory','project_briefs','documents','jobs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

alter table public.profiles enable row level security;
create policy "own profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());

alter table public.plans enable row level security;
create policy "own plan" on public.plans for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Users may READ their plan and usage, but only the server (service role) may change them.
alter table public.subscriptions enable row level security;
create policy "read own subscription" on public.subscriptions for select using (user_id = auth.uid());

alter table public.usage enable row level security;
create policy "read own usage" on public.usage for select using (user_id = auth.uid());

-- ---------- new user setup ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, age_confirmed, country)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
          coalesce((new.raw_user_meta_data->>'age_confirmed')::boolean, false),
          nullif(new.raw_user_meta_data->>'country', ''));
  insert into public.subscriptions (user_id) values (new.id);
  insert into public.plans (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- helpers used by the server functions ----------
-- The plan a user effectively has right now ('free' or 'pro').
create or replace function public.effective_plan(uid uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when s.plan = 'pro' then 'pro'
    when s.plan = 'trial' and s.trial_ends_at > now() then 'pro'
    else 'free' end
  from public.subscriptions s where s.user_id = uid
$$;

-- Add to a user's monthly counters (called by the server with the service role only).
create or replace function public.add_usage(uid uuid, field text, amount int, in_tok bigint default 0, out_tok bigint default 0, cost numeric default 0)
returns void language plpgsql security definer set search_path = public as $$
declare m text := to_char(now() at time zone 'utc', 'YYYY-MM');
begin
  if field not in ('uploads','tutor_messages','weekly_sheets','exam_sheets','papers','none') then
    raise exception 'unknown usage field %', field;
  end if;
  insert into public.usage (user_id, month) values (uid, m) on conflict do nothing;
  if field <> 'none' then
    execute format('update public.usage set %I = %I + $1 where user_id = $2 and month = $3', field, field) using amount, uid, m;
  end if;
  update public.usage set input_tokens = input_tokens + in_tok, output_tokens = output_tokens + out_tok, cost_usd = cost_usd + cost
   where user_id = uid and month = m;
end $$;
revoke execute on function public.add_usage from public, anon, authenticated;

-- ---------- file storage: a private bucket, one folder per user ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('materials', 'materials', false, 52428800)  -- 50 MB per file
on conflict (id) do nothing;

create policy "own files read" on storage.objects for select
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own files write" on storage.objects for insert
  with check (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own files delete" on storage.objects for delete
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- course limit: Free plan allows 2 courses ----------
create or replace function public.enforce_course_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.effective_plan(new.user_id) = 'free'
     and (select count(*) from public.courses where user_id = new.user_id) >= 2 then
    raise exception 'course_limit: the free plan allows 2 courses';
  end if;
  return new;
end $$;

create trigger courses_limit before insert on public.courses
  for each row execute function public.enforce_course_limit();
