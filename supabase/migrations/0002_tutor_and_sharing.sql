-- StudyBuddy step 2-6 additions. Run once in the SQL Editor after 0001_init.sql.

-- A per-chat style change the student asked to keep ("explain more simply for the rest of this chat").
alter table public.chats add column if not exists modifier text;

-- Notification and calendar preferences.
alter table public.profiles add column if not exists notify jsonb not null default '{"daily": true, "deadlines": true, "exams": true}';
alter table public.profiles add column if not exists calendar_sync boolean not null default false;
alter table public.profiles add column if not exists onboarded boolean not null default false;

-- Reports on AI answers (App Store requirement).
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  chat_id uuid references public.chats(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  excerpt text,
  reason text,
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
create policy "insert own reports" on public.reports for insert with check (user_id = auth.uid());
create policy "read own reports" on public.reports for select using (user_id = auth.uid());

-- Share links: anyone with the link can read ONE document (never the original course files).
create or replace function public.get_shared_document(token text)
returns table (title text, body text, kind text, course_code text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select d.title, d.body, d.kind, c.code, d.created_at
  from public.documents d join public.courses c on c.id = d.course_id
  where d.share_token = token and length(token) >= 20
$$;
grant execute on function public.get_shared_document(text) to anon, authenticated;

-- Indexes for the common lookups.
create index if not exists materials_course_idx on public.materials (course_id);
create index if not exists chunks_material_idx on public.material_chunks (material_id, n);
create index if not exists deadlines_user_due_idx on public.deadlines (user_id, due_at);
create index if not exists chats_user_updated_idx on public.chats (user_id, updated_at desc);
create index if not exists documents_course_idx on public.documents (course_id, kind);
create index if not exists memory_course_idx on public.memory (user_id, course_id, kind);
create index if not exists jobs_user_idx on public.jobs (user_id, created_at desc);
