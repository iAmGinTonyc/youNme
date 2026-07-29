-- Schedules the "3 hours before" reminder job. Applied directly against
-- the live DB this session (pg_cron + pg_net enabled, job created) — this
-- file documents that state for anyone rebuilding the project from
-- scratch. Public repo: replace <CRON_SECRET> with the real value (must
-- match the CRON_SECRET Edge Function secret) before running.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'send-reminders',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://dfntlaflldirllhtnjzw.supabase.co/functions/v1/send-reminders',
    headers := '{"Content-Type":"application/json","x-cron-secret":"<CRON_SECRET>"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
