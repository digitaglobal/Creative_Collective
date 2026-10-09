create or replace function public.allocate_booking(p_booking uuid,p_start timestamptz,p_end timestamptz,p_extra_ids text[] default '{}') returns void language plpgsql security definer set search_path=public as $$
declare cfg settings; b bookings; occupied_range tstzrange;
begin
 select * into strict cfg from settings; select * into strict b from bookings where id=p_booking;
 occupied_range:=tstzrange(p_start-make_interval(mins=>cfg.buffer_minutes),p_end+make_interval(mins=>cfg.buffer_minutes),'[)');
 if exists(select 1 from resources r where r.id in (select resource_id from service_resources where service_id=b.service_id union select resource_id from extra_resources where service_id=b.service_id and extra_id=any(p_extra_ids)) and not r.approved) then raise exception 'A required resource awaits approval'; end if;
 if exists(select 1 from closures c where (c.resource_id is null or c.resource_id in(select resource_id from service_resources where service_id=b.service_id union select resource_id from extra_resources where service_id=b.service_id and extra_id=any(p_extra_ids))) and tstzrange(c.starts_at,c.ends_at,'[)') && occupied_range) then raise exception 'A required resource is closed'; end if;
 insert into allocations(booking_id,resource_id,occupied)
 select b.id,resource_id,occupied_range from (
  select resource_id from service_resources where service_id=b.service_id
  union select resource_id from extra_resources where service_id=b.service_id and extra_id=any(p_extra_ids)
 ) x order by resource_id;
exception when exclusion_violation then raise exception 'That space was just reserved. Choose another time.' using errcode='23P01';
end; $$;

create function public.update_enquiry(p_id uuid,p_state text) returns void language plpgsql security definer set search_path=public as $$
begin perform require_staff(); if p_state not in ('new','reviewing','quoted','closed') then raise exception 'Invalid enquiry state'; end if;
 update enquiries set state=p_state where id=p_id;
 insert into audit_events(actor_id,action,details) values(auth.uid(),'enquiry_updated',jsonb_build_object('enquiry',p_id,'state',p_state));
end; $$;
create function public.link_enquiry_account(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare e enquiries; who uuid;
begin perform require_staff(); select * into strict e from enquiries where id=p_id for update;
 select id into who from auth.users where lower(email)=lower(e.email) and email_confirmed_at is not null;
 if who is null then raise exception 'No verified account matches this enquiry email. Ask the customer to create and verify their account.'; end if;
 update enquiries set customer_id=who where id=p_id;
 insert into audit_events(actor_id,action,details) values(auth.uid(),'enquiry_linked',jsonb_build_object('enquiry',p_id,'customer',who));
end; $$;
revoke execute on function public.update_enquiry(uuid,text),public.link_enquiry_account(uuid) from public,anon,authenticated;
grant execute on function public.update_enquiry(uuid,text),public.link_enquiry_account(uuid) to authenticated,service_role;

-- Quote/booking records can only be changed through authorized RPCs. Configuration
-- mutations use RLS and append-only audit triggers; customer profile role is not writable.
revoke insert,update,delete on bookings,allocations,payments,change_requests,enquiries,quotes,internal_notes,audit_events,notification_jobs from anon,authenticated;
grant select on bookings,allocations,payments,change_requests,enquiries,quotes,internal_notes,audit_events,notification_jobs to authenticated;
grant select on profiles to authenticated;
grant select,insert,update,delete on settings,brands,services,resources,service_resources,extra_resources,closures,policies to authenticated;
