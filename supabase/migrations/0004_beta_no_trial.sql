-- Beta: new accounts start on Free (no automatic Pro trial), to keep AI costs inside the test budget.
-- To bring the 7-day trial back later:
--   alter table public.subscriptions alter column plan set default 'trial';
--   alter table public.subscriptions alter column trial_ends_at set default (now() + interval '7 days');
alter table public.subscriptions alter column plan set default 'free';
alter table public.subscriptions alter column trial_ends_at set default null;
update public.subscriptions set plan = 'free', trial_ends_at = null where plan = 'trial';

-- Lets the start script see which database updates have been run.
create or replace function public.schema_version() returns int language sql stable as $$ select 4 $$;
grant execute on function public.schema_version() to anon, authenticated;
