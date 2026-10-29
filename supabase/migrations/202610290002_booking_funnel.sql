-- No contact details, user IDs, URLs or IP addresses are stored in this funnel.
create table public.booking_funnel (
  day date not null default current_date,
  session_id uuid not null,
  service_id text not null references public.services(id),
  step text not null check(step in ('space_viewed','time_selected','checkout_started','request_submitted')),
  device text not null check(device in ('mobile','desktop')),
  booking_id uuid references public.bookings(id) on delete set null,
  primary key(day,session_id,service_id,step)
);
alter table public.booking_funnel enable row level security;
revoke all on public.booking_funnel from anon,authenticated;

create function public.record_booking_step(p_session uuid,p_service text,p_step text,p_device text,p_booking uuid default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  if p_session is null or p_step not in ('space_viewed','time_selected','checkout_started','request_submitted')
    or p_device not in ('mobile','desktop') then raise exception 'Invalid measurement'; end if;
  if not exists(select 1 from services where id=p_service) then return; end if;
  if p_step='request_submitted' then
    if not exists(select 1 from bookings where id=p_booking and customer_id=auth.uid() and service_id=p_service) then return; end if;
  elsif p_booking is not null then return;
  end if;
  insert into booking_funnel(session_id,service_id,step,device,booking_id)
  values(p_session,p_service,p_step,p_device,p_booking) on conflict do nothing;
end;
$$;
revoke all on function public.record_booking_step(uuid,text,text,text,uuid) from public;
grant execute on function public.record_booking_step(uuid,text,text,text,uuid) to anon,authenticated;

create function public.booking_funnel_report() returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
  perform require_staff();
  select coalesce(jsonb_agg(row_to_json(r)),'[]'::jsonb) into result from (
    select device,
      count(distinct session_id) filter(where step='space_viewed') as space_viewed,
      count(distinct session_id) filter(where step='time_selected') as time_selected,
      count(distinct session_id) filter(where step='checkout_started') as checkout_started,
      count(distinct session_id) filter(where step='request_submitted') as request_submitted,
      count(distinct session_id) filter(where step='request_submitted' and b.booking_state in ('confirmed','checked_in','completed')) as confirmed,
      count(distinct session_id) filter(where step='request_submitted' and b.booking_state='cancelled') as cancelled,
      count(distinct session_id) filter(where step='request_submitted' and b.booking_state='expired') as expired
    from booking_funnel f left join bookings b on b.id=f.booking_id
    where f.day>=current_date-29 group by device
  ) r;
  return result;
end;
$$;
revoke all on function public.booking_funnel_report() from public;
grant execute on function public.booking_funnel_report() to authenticated;
