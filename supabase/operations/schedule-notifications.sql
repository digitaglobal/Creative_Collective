-- Run after notification-worker is deployed and its sender is verified.
-- Store the exact worker JOB_SECRET in Vault under cc_notification_job_secret,
-- and the project URL under cc_notification_project_url before running this.
-- Never paste credentials into this file or the scheduled command.
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$ begin
 if not exists(select 1 from vault.decrypted_secrets where name='cc_notification_job_secret' and length(decrypted_secret)>0)
 or not exists(select 1 from vault.decrypted_secrets where name='cc_notification_project_url' and length(decrypted_secret)>0)
 then raise exception 'Notification worker URL and job secret must be configured in Vault first'; end if;
end $$;

select cron.schedule('creative-collective-booking-notifications','* * * * *', $job$
 select net.http_post(
  url := (select rtrim(decrypted_secret,'/') from vault.decrypted_secrets where name='cc_notification_project_url') || '/functions/v1/notification-worker',
  headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='cc_notification_job_secret')),
  body := '{}'::jsonb,
  timeout_milliseconds := 5000
 );
$job$);
