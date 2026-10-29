-- Hosted Supabase only: run as the database owner, outside application migrations.
-- Safe to rerun: named jobs are updated rather than duplicated.
create extension if not exists pg_cron;
select cron.schedule(
  'creative-collective-reservation-expiry',
  '* * * * *',
  'select public.expire_reservations();'
);
