create function public.claim_notifications(p_limit integer default 25) returns setof notification_jobs language plpgsql security definer set search_path=public as $$
begin
 return query with candidates as (
  select id from notification_jobs where attempts<5 and due_at<=now()
  and (state='pending' or (state='processing' and locked_at<now()-interval '10 minutes'))
  order by due_at for update skip locked limit least(greatest(p_limit,1),25)
 ) update notification_jobs j set state='processing',locked_at=now(),attempts=j.attempts+1
 from candidates c where j.id=c.id returning j.*;
 update notification_jobs set state='failed',last_error=coalesce(last_error,'Retry limit reached')
 where state='processing' and attempts>=5 and locked_at<now()-interval '10 minutes';
end; $$;
revoke execute on function public.claim_notifications(integer) from public,anon,authenticated;
grant execute on function public.claim_notifications(integer) to service_role;
