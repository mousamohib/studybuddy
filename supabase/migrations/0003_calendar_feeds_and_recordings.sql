-- School calendar feeds (Brightspace / Canvas / Moodle / Blackboard iCal links) and lecture recordings.

-- ---------- calendar feeds ----------
create table if not exists public.calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  url text not null,            -- private feed link; only its owner can read it
  label text,                   -- "Brightspace", "Canvas"… guessed from the link
  last_synced_at timestamptz,
  last_result jsonb,            -- {added, updated, unmatched:[{code,count}], skipped, error}
  created_at timestamptz not null default now(),
  unique (user_id, url)
);
alter table public.calendar_feeds enable row level security;
drop policy if exists "own rows" on public.calendar_feeds;
create policy "own rows" on public.calendar_feeds for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Where a deadline came from, so a feed can update the same row when a date moves.
alter table public.deadlines add column if not exists source text;        -- 'syllabus' | 'calendar' | 'you' | null
alter table public.deadlines add column if not exists source_uid text;    -- '<feed id>:<event UID>'
create unique index if not exists deadlines_source_uid on public.deadlines (user_id, source_uid) where source_uid is not null;

-- Recordings are transcribed and then the video/audio file is deleted, so storage_path can be empty.
-- (materials.storage_path is already nullable.)
