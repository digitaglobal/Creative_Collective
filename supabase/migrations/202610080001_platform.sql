create extension if not exists btree_gist;
create extension if not exists pgcrypto;

create table public.profiles (
 id uuid primary key references auth.users on delete cascade,
 full_name text not null default '' check(length(full_name)<=200), phone text not null default '' check(length(phone)<=50),
 role text not null default 'customer' check (role in ('customer','staff','administrator'))
);
create function public.is_staff() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles where id=auth.uid() and role in ('staff','administrator'));
$$;
create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles where id=auth.uid() and role='administrator');
$$;
create function public.require_staff() returns void language plpgsql security definer set search_path=public as $$
begin if not is_staff() then raise exception 'Staff access required' using errcode='42501'; end if; end;
$$;
create function public.new_profile() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into profiles(id,full_name,phone) values(new.id,left(coalesce(new.raw_user_meta_data->>'full_name',''),200),left(coalesce(new.raw_user_meta_data->>'phone',''),50)); return new; end;
$$;
create trigger new_user after insert on auth.users for each row execute function new_profile();
insert into profiles(id,full_name,phone)
 select id,left(coalesce(raw_user_meta_data->>'full_name',''),200),left(coalesce(raw_user_meta_data->>'phone',''),50) from auth.users
 on conflict(id) do nothing;

create table public.settings (
 id boolean primary key default true check(id), timezone text not null default 'America/Jamaica' check(timezone='America/Jamaica'),
 currency text not null default 'JMD' check(currency='JMD'), advance_notice_hours integer not null default 4 check(advance_notice_hours>=0),
 horizon_days integer not null default 90 check(horizon_days between 1 and 365), hold_minutes integer not null default 10 check(hold_minutes between 1 and 60),
 buffer_minutes integer not null default 0 check(buffer_minutes between 0 and 120), tax_basis_points integer check(tax_basis_points between 0 and 10000),
 launch_approved boolean not null default false, online_payments_enabled boolean not null default false check(not online_payments_enabled),
 weekday_open time not null default '08:00', weekday_close time not null default '20:00',
 saturday_open time not null default '09:00', saturday_close time not null default '17:00', sunday_closed boolean not null default true,
 check(weekday_close>weekday_open and saturday_close>saturday_open)
);
insert into settings(id) values(true);
create table public.brands(id text primary key, document jsonb not null);
create table public.resources(id text primary key, brand text not null references brands, name text not null, approved boolean not null default false);
create table public.services(id text primary key, brand text not null references brands, slug text not null, document jsonb not null,
 approved boolean not null default false, unique(brand,slug));
create table public.service_resources(service_id text references services on delete cascade, resource_id text references resources, primary key(service_id,resource_id));
create table public.extra_resources(service_id text references services on delete cascade, extra_id text not null, resource_id text references resources, primary key(service_id,extra_id,resource_id));
create table public.closures(id uuid primary key default gen_random_uuid(), resource_id text references resources, starts_at timestamptz not null, ends_at timestamptz not null, reason text not null, check(ends_at>starts_at));
create table public.policies(id text primary key, title text not null, body text not null, version integer not null default 1, approved boolean not null default false);

create table public.bookings (
 id uuid primary key default gen_random_uuid(), reference text not null unique default ('CC-'||upper(encode(gen_random_bytes(6),'hex'))),
 customer_id uuid not null references profiles, customer_email text not null, customer_name text not null,
 service_id text not null references services, service_name text not null, brand text not null references brands,
 starts_at timestamptz not null, ends_at timestamptz not null, attendees integer not null check(attendees>0),
 total_minor bigint not null check(total_minor>=0), paid_minor bigint not null default 0 check(paid_minor>=0), price_snapshot jsonb not null,
 booking_state text not null default 'pending_confirmation' check(booking_state in ('held','pending_confirmation','confirmed','checked_in','completed','no_show','cancelled','expired','payment_exception')),
 payment_state text not null default 'unpaid' check(payment_state in ('unpaid','pending','paid','failed','refunded')),
 expires_at timestamptz, arrival_instructions text not null default '', policy_snapshot jsonb not null, acknowledgement_snapshot text,
 idempotency_key uuid not null, created_at timestamptz not null default now(), unique(customer_id,idempotency_key), check(ends_at>starts_at)
);
create table public.allocations (
 id uuid primary key default gen_random_uuid(), booking_id uuid not null references bookings on delete cascade,
 resource_id text not null references resources, occupied tstzrange not null,
 exclude using gist(resource_id with =, occupied with &&)
);
create table public.payments(id uuid primary key default gen_random_uuid(), booking_id uuid not null references bookings,
 amount_minor bigint not null check(amount_minor>0), kind text not null check(kind in ('payment','refund')),
 method text not null, reference text not null, actor_id uuid references profiles,
 idempotency_key uuid not null unique, created_at timestamptz not null default now());
create table public.change_requests(id uuid primary key default gen_random_uuid(), booking_id uuid not null references bookings,
 kind text not null check(kind in ('cancel','reschedule')), proposed_start timestamptz, proposed_end timestamptz, reason text not null,
 state text not null default 'pending' check(state in ('pending','approved','rejected')), created_at timestamptz not null default now());
create unique index one_pending_change on change_requests(booking_id) where state='pending';
create table public.enquiries(id uuid primary key default gen_random_uuid(), customer_id uuid references profiles, service_id text not null references services,
 contact_name text not null, email text not null, phone text not null, start_date date not null, end_date date not null,
 rental_period text not null check(rental_period in ('hourly','daily','weekly','monthly')), attendees integer not null check(attendees>0),
 message text not null, idempotency_key uuid not null unique default gen_random_uuid(), state text not null default 'new' check(state in ('new','reviewing','quoted','closed')), created_at timestamptz not null default now(), check(end_date>=start_date));
create table public.quotes(id uuid primary key default gen_random_uuid(), enquiry_id uuid not null references enquiries,
 version integer not null, idempotency_key uuid not null unique default gen_random_uuid(), customer_id uuid not null references profiles, service_id text not null references services,
 starts_at timestamptz not null, ends_at timestamptz not null, attendees integer not null check(attendees>0),
 lines jsonb not null, extra_ids text[] not null default '{}', subtotal_minor bigint not null check(subtotal_minor>=0), tax_basis_points integer not null check(tax_basis_points between 0 and 10000),
 total_minor bigint not null check(total_minor>=0), expires_at timestamptz not null, instructions text not null,
 state text not null default 'offered' check(state in ('offered','accepted','superseded')), booking_id uuid references bookings,
 created_at timestamptz not null default now(), unique(enquiry_id,version), check(ends_at>starts_at));
create table public.internal_notes(id uuid primary key default gen_random_uuid(), booking_id uuid not null references bookings, body text not null, actor_id uuid not null references profiles, created_at timestamptz not null default now());
create table public.audit_events(id uuid primary key default gen_random_uuid(), booking_id uuid references bookings, actor_id uuid references profiles, action text not null, details jsonb not null default '{}', created_at timestamptz not null default now());
create table public.notification_jobs(id uuid primary key default gen_random_uuid(), booking_id uuid references bookings,
 dedupe_key text not null unique, recipient text not null, subject text not null, body text not null,
 due_at timestamptz not null default now(), attempts integer not null default 0,
 state text not null default 'pending' check(state in ('pending','processing','sent','failed','cancelled')),
 locked_at timestamptz, last_error text, sent_at timestamptz, created_at timestamptz not null default now());
create index due_notifications on notification_jobs(due_at) where state in ('pending','processing');
create index booking_customer on bookings(customer_id,starts_at);

alter table profiles enable row level security;
create policy profile_read on profiles for select to authenticated using(id=auth.uid() or is_staff());
create policy profile_edit on profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
grant select on profiles to authenticated;
revoke update on profiles from authenticated;
grant update(full_name,phone) on profiles to authenticated;
do $$ declare t text; begin
 foreach t in array array['settings','brands','resources','services','service_resources','extra_resources','closures','policies'] loop
  execute format('alter table %I enable row level security',t);
  execute format('create policy config_read on %I for select to authenticated using(public.is_staff())',t);
  execute format('create policy config_admin on %I for all to authenticated using(public.is_admin()) with check(public.is_admin())',t);
 end loop;
 foreach t in array array['bookings','payments','change_requests','enquiries','quotes','internal_notes','audit_events','notification_jobs','allocations'] loop
  execute format('alter table %I enable row level security',t);
  execute format('create policy staff_read on %I for select to authenticated using(public.is_staff())',t);
 end loop;
end $$;
create policy customer_bookings on bookings for select to authenticated using(customer_id=auth.uid());
create policy customer_payments on payments for select to authenticated using(exists(select 1 from bookings where id=booking_id and customer_id=auth.uid()));
create policy customer_changes on change_requests for select to authenticated using(exists(select 1 from bookings where id=booking_id and customer_id=auth.uid()));
create policy customer_enquiries on enquiries for select to authenticated using(customer_id=auth.uid());
create policy customer_quotes on quotes for select to authenticated using(customer_id=auth.uid());

create function public.public_catalog() returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('brands',coalesce((select jsonb_agg(document) from brands),'[]'::jsonb),
 'services',coalesce((select jsonb_agg(document || jsonb_build_object('bookableHourly',approved and coalesce((document->>'bookableHourly')::boolean,false) and exists(select 1 from service_resources sr join resources r on r.id=sr.resource_id where sr.service_id=s.id and r.approved)) || jsonb_build_object('resourceIds',coalesce((select jsonb_agg(resource_id) from service_resources where service_id=s.id),'[]'::jsonb))) from services s where document->>'status'='published'),'[]'::jsonb),
 'rules',jsonb_build_object('horizonDays',horizon_days,'advanceNoticeHours',advance_notice_hours),
 'ready',launch_approved and tax_basis_points is not null and (select count(*)=7 and bool_and(approved) from policies)) from settings;
$$;
create function public.public_policies() returns setof policies language sql stable security definer set search_path=public as $$ select * from policies where approved; $$;

create function public.queue_booking_email(p_booking uuid,p_event text,p_due timestamptz default now()) returns void language plpgsql security definer set search_path=public as $$
declare b bookings; begin select * into strict b from bookings where id=p_booking;
 insert into notification_jobs(booking_id,dedupe_key,recipient,subject,body,due_at)
 values(b.id,b.id||':'||p_event||':'||b.booking_state||':'||b.starts_at||':'||b.paid_minor,b.customer_email,
 'Creative Collective — '||p_event||' — '||b.reference,
 b.service_name||E'\nReference: '||b.reference||E'\nStatus: '||b.booking_state||E'\nJamaica time: '||to_char(b.starts_at at time zone 'America/Jamaica','YYYY-MM-DD HH24:MI')||E'\nBalance (JMD): '||((b.total_minor-b.paid_minor)::numeric/100)||E'\n'||b.arrival_instructions,p_due)
 on conflict(dedupe_key) do nothing;
end; $$;
create function public.expire_reservations() returns integer language plpgsql security definer set search_path=public as $$
declare b bookings; n integer:=0; begin
 for b in select * from bookings where booking_state in ('held','pending_confirmation') and expires_at<=now() for update loop
  update bookings set booking_state='expired',expires_at=null where id=b.id;
  delete from allocations where booking_id=b.id;
  insert into audit_events(booking_id,action) values(b.id,'expired');
  perform queue_booking_email(b.id,'Reservation expired'); n:=n+1;
 end loop; return n;
end; $$;

create function public.validate_session(p_service text,p_start timestamptz,p_end timestamptz,p_attendees integer,p_long boolean default false) returns jsonb language plpgsql security definer set search_path=public as $$
declare s services; cfg settings; local_start timestamp; local_end timestamp; minutes numeric; opening time; closing time;
begin
 select * into strict cfg from settings;
 select * into strict s from services where id=p_service;
 if not cfg.launch_approved or cfg.tax_basis_points is null or not (select count(*)=7 and bool_and(approved) from policies) then raise exception 'Bookings await approved business configuration, tax and policies'; end if;
 if not s.approved or s.document->>'status'<>'published' or (not p_long and (not coalesce((s.document->>'bookableHourly')::boolean,false) or s.document->>'hourlyRateMinor' is null)) then raise exception 'This service is enquiry only'; end if;
 if not exists(select 1 from service_resources where service_id=s.id) or exists(select 1 from service_resources sr join resources r on r.id=sr.resource_id where sr.service_id=s.id and not r.approved) then raise exception 'Resource inventory needs approval'; end if;
 if p_start is null or p_end is null or p_end<=p_start or p_attendees is null or p_attendees<1 or p_attendees>(s.document->>'maxAttendees')::integer then raise exception 'Invalid time or capacity'; end if;
 if p_start<now()+make_interval(hours=>cfg.advance_notice_hours) or (p_start at time zone cfg.timezone)::date>(now() at time zone cfg.timezone)::date+cfg.horizon_days then raise exception 'Outside booking notice or horizon'; end if;
 local_start:=p_start at time zone cfg.timezone; local_end:=p_end at time zone cfg.timezone;
 minutes:=extract(epoch from(p_end-p_start))/60;
 if not p_long then
  if local_start::date<>local_end::date or minutes<(s.document->>'minDurationMinutes')::integer or minutes>(s.document->>'maxDurationMinutes')::integer or mod(minutes-(s.document->>'minDurationMinutes')::integer,(s.document->>'stepMinutes')::integer)<>0 then raise exception 'Invalid booking duration'; end if;
  if extract(dow from local_start)=0 and cfg.sunday_closed then raise exception 'Venue closed'; end if;
  opening:=case when extract(dow from local_start)=6 then cfg.saturday_open else cfg.weekday_open end;
  closing:=case when extract(dow from local_start)=6 then cfg.saturday_close else cfg.weekday_close end;
  if local_start::time<opening or local_end::time>closing or mod(extract(epoch from(local_start::time-opening))/60,(s.document->>'stepMinutes')::integer)<>0 then raise exception 'Outside opening hours or start-time increments'; end if;
 else
  if local_end::date>(now() at time zone cfg.timezone)::date+365 then raise exception 'Rental end exceeds one year'; end if;
 end if;
 if exists(select 1 from closures c where (c.resource_id is null or c.resource_id in(select resource_id from service_resources where service_id=s.id)) and tstzrange(c.starts_at,c.ends_at,'[)') && tstzrange(p_start-make_interval(mins=>cfg.buffer_minutes),p_end+make_interval(mins=>cfg.buffer_minutes),'[)')) then raise exception 'Venue or resource closed'; end if;
 return s.document;
end; $$;

create function public.allocate_booking(p_booking uuid,p_start timestamptz,p_end timestamptz,p_extra_ids text[] default '{}') returns void language plpgsql security definer set search_path=public as $$
declare cfg settings; b bookings; begin
 select * into strict cfg from settings; select * into strict b from bookings where id=p_booking;
 insert into allocations(booking_id,resource_id,occupied)
 select b.id,resource_id,tstzrange(p_start-make_interval(mins=>cfg.buffer_minutes),p_end+make_interval(mins=>cfg.buffer_minutes),'[)') from (
  select resource_id from service_resources where service_id=b.service_id
  union select resource_id from extra_resources where service_id=b.service_id and extra_id=any(p_extra_ids)
 ) x order by resource_id;
exception when exclusion_violation then raise exception 'That space was just reserved. Choose another time.' using errcode='23P01';
end; $$;

create function public.submit_booking(p_service text,p_start timestamptz,p_duration integer,p_attendees integer,p_key uuid,p_policy_versions jsonb,p_extra_ids text[] default '{}',p_customer uuid default null,p_service_ack boolean default false) returns bookings language plpgsql security definer set search_path=public as $$
declare who uuid:=coalesce(p_customer,auth.uid()); b bookings; doc jsonb; cfg settings; customer profiles; customer_email text; ending timestamptz; subtotal bigint; total bigint; lines jsonb; extra jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in to reserve' using errcode='42501'; end if;
 if p_customer is not null then perform require_staff(); end if;
 select * into b from bookings where customer_id=who and idempotency_key=p_key; if found then return b; end if;
 if not exists(select 1 from auth.users where id=who and email_confirmed_at is not null) then raise exception 'Verify your email before reserving'; end if;
 if p_duration is null or p_duration<1 or p_duration>480 then raise exception 'Invalid duration'; end if;
 ending:=p_start+make_interval(mins=>p_duration);
 perform expire_reservations(); doc:=validate_session(p_service,p_start,ending,p_attendees);
 if coalesce(doc->>'acknowledgement','')<>'' and not coalesce(p_service_ack,false) then raise exception 'Accept the service acknowledgement'; end if;
 select * into strict cfg from settings; select * into strict customer from profiles where id=who;
 select email into customer_email from auth.users where id=who;
 if trim(customer.full_name)='' or trim(customer.phone)='' then raise exception 'Complete your name and phone in your profile'; end if;
 if p_policy_versions is null or p_policy_versions<>(select jsonb_object_agg(id,version) from policies where approved) then raise exception 'Please accept the current policies'; end if;
 subtotal:=round((doc->>'hourlyRateMinor')::numeric*p_duration/60);
 lines:=jsonb_build_array(jsonb_build_object('label',doc->>'name','amountMinor',subtotal));
 if cardinality(p_extra_ids)<>(select count(distinct x) from unnest(p_extra_ids) x) then raise exception 'Duplicate extras'; end if;
 foreach extra in array array(select value from jsonb_array_elements(coalesce(doc->'addons','[]')) where value->>'id'=any(p_extra_ids)) loop
  if extra->>'status'<>'published' then raise exception 'Extra unavailable'; end if;
  total:=round((extra->>'amountMinor')::numeric*case when extra->>'basis'='per-hour' then p_duration::numeric/60 else 1 end);
  subtotal:=subtotal+total; lines:=lines||jsonb_build_array(jsonb_build_object('label',extra->>'name','amountMinor',total));
 end loop;
 if cardinality(p_extra_ids)<>(select count(*) from jsonb_array_elements(coalesce(doc->'addons','[]')) where value->>'id'=any(p_extra_ids)) then raise exception 'Unknown extra'; end if;
 if exists(select 1 from extra_resources er join resources r on r.id=er.resource_id where er.service_id=p_service and er.extra_id=any(p_extra_ids) and not r.approved) then raise exception 'Extra resource unavailable'; end if;
 total:=subtotal+round(subtotal::numeric*cfg.tax_basis_points/10000);
 lines:=lines||jsonb_build_array(jsonb_build_object('label','Tax','amountMinor',total-subtotal));
 insert into bookings(customer_id,customer_email,customer_name,service_id,service_name,brand,starts_at,ends_at,attendees,total_minor,price_snapshot,policy_snapshot,idempotency_key,expires_at,arrival_instructions,acknowledgement_snapshot)
 values(who,customer_email,customer.full_name,p_service,doc->>'name',doc->>'brand',p_start,ending,p_attendees,total,
 jsonb_build_object('lines',lines,'currency',cfg.currency,'taxBasisPoints',cfg.tax_basis_points,'extraIds',p_extra_ids,'hourlyRateMinor',doc->'hourlyRateMinor'),p_policy_versions,p_key,least(now()+interval '24 hours',p_start),coalesce((select document->>'arrivalInstructions' from brands where id=doc->>'brand'),''),doc->>'acknowledgement') returning * into b;
 perform allocate_booking(b.id,p_start,ending,p_extra_ids);
 insert into audit_events(booking_id,actor_id,action) values(b.id,auth.uid(),'submitted');
 perform queue_booking_email(b.id,'Reservation submitted'); return b;
end; $$;

create function public.available_slots(p_service text,p_date date,p_duration integer,p_extra_ids text[] default '{}') returns jsonb language plpgsql security definer set search_path=public as $$
declare cfg settings; doc jsonb; t timestamptz; ending timestamptz; opening time; closing time; slots jsonb:='[]'; available boolean; reason text;
begin
 select * into strict cfg from settings; select document into strict doc from services where id=p_service;
 if p_duration is null or p_duration<1 or p_duration>480 or p_date is null or p_date<(now() at time zone cfg.timezone)::date or p_date>(now() at time zone cfg.timezone)::date+cfg.horizon_days then return '[]'; end if;
 if extract(dow from p_date)=0 and cfg.sunday_closed then return '[]'; end if;
 opening:=case when extract(dow from p_date)=6 then cfg.saturday_open else cfg.weekday_open end;
 closing:=case when extract(dow from p_date)=6 then cfg.saturday_close else cfg.weekday_close end;
 for t in select generate_series((p_date+opening) at time zone cfg.timezone,((p_date+closing) at time zone cfg.timezone)-make_interval(mins=>p_duration),make_interval(mins=>(doc->>'stepMinutes')::integer)) loop
  ending:=t+make_interval(mins=>p_duration); available:=true; reason:=null;
  begin perform validate_session(p_service,t,ending,1); exception when others then available:=false; reason:=sqlerrm; end;
  if available and exists(select 1 from allocations a join bookings b on b.id=a.booking_id where a.resource_id in (
   select resource_id from service_resources where service_id=p_service union select resource_id from extra_resources where service_id=p_service and extra_id=any(p_extra_ids))
   and (b.expires_at is null or b.expires_at>now()) and a.occupied && tstzrange(t-make_interval(mins=>cfg.buffer_minutes),ending+make_interval(mins=>cfg.buffer_minutes),'[)')) then available:=false; reason:='Already reserved'; end if;
  slots:=slots||jsonb_build_array(jsonb_build_object('start',to_char(t at time zone cfg.timezone,'HH24:MI'),'end',to_char(ending at time zone cfg.timezone,'HH24:MI'),'available',available,'reason',reason));
 end loop; return slots;
end; $$;

create function public.transition_booking(p_id uuid,p_state text) returns bookings language plpgsql security definer set search_path=public as $$
declare b bookings; begin
 perform require_staff(); perform expire_reservations(); select * into strict b from bookings where id=p_id for update;
 if b.booking_state=p_state then return b; end if;
 if not ((b.booking_state='pending_confirmation' and p_state in ('confirmed','cancelled')) or (b.booking_state='confirmed' and p_state in ('checked_in','cancelled','no_show')) or (b.booking_state='checked_in' and p_state in ('completed','cancelled'))) then raise exception 'Invalid booking transition'; end if;
 if p_state='no_show' and b.starts_at>now() then raise exception 'Session has not started'; end if;
 update bookings set booking_state=p_state,expires_at=null where id=p_id returning * into b;
 if p_state in ('cancelled','completed','no_show') then delete from allocations where booking_id=p_id; end if;
 update notification_jobs set state='cancelled' where booking_id=p_id and subject like '%Session reminder%' and state in ('pending','processing');
 if p_state='confirmed' and b.starts_at>now()+interval '24 hours' then perform queue_booking_email(p_id,'Session reminder',b.starts_at-interval '24 hours'); end if;
 insert into audit_events(booking_id,actor_id,action) values(p_id,auth.uid(),p_state);
 perform queue_booking_email(p_id,case when p_state='cancelled' then 'Reservation cancelled or rejected' else 'Reservation '||p_state end); return b;
end; $$;

create function public.record_payment(p_id uuid,p_amount bigint,p_kind text,p_method text,p_reference text,p_key uuid) returns bookings language plpgsql security definer set search_path=public as $$
declare b bookings; prior payments; paid bigint; begin
 perform require_staff(); select * into strict b from bookings where id=p_id for update;
 select * into prior from payments where idempotency_key=p_key;
 if found then if prior.booking_id<>p_id or prior.amount_minor<>p_amount or prior.kind<>p_kind then raise exception 'Payment retry does not match original'; end if; return b; end if;
 if p_amount is null or p_amount<=0 or p_kind not in ('payment','refund') or length(trim(p_method))=0 or length(trim(p_reference))=0 then raise exception 'Invalid payment details'; end if;
 if p_kind='refund' and p_amount>b.paid_minor then raise exception 'Refund exceeds recorded payments'; end if;
 if p_kind='payment' and p_amount>b.total_minor-b.paid_minor then raise exception 'Payment exceeds balance'; end if;
 insert into payments(booking_id,amount_minor,kind,method,reference,actor_id,idempotency_key) values(p_id,p_amount,p_kind,p_method,p_reference,auth.uid(),p_key);
 select coalesce(sum(case when kind='payment' then amount_minor else -amount_minor end),0) into paid from payments where booking_id=p_id;
 update bookings set paid_minor=paid,payment_state=case when paid>=total_minor then 'paid' when paid=0 and p_kind='refund' then 'refunded' else 'unpaid' end where id=p_id returning * into b;
 insert into audit_events(booking_id,actor_id,action,details) values(p_id,auth.uid(),p_kind,jsonb_build_object('amountMinor',p_amount,'reference',p_reference));
 perform queue_booking_email(p_id,'Payment '||p_kind||' recorded'); return b;
end; $$;

create function public.request_change(p_id uuid,p_kind text,p_start timestamptz,p_end timestamptz,p_reason text) returns change_requests language plpgsql security definer set search_path=public as $$
declare b bookings; r change_requests; begin
 select * into strict b from bookings where id=p_id and customer_id=auth.uid() for update;
 if b.booking_state not in ('pending_confirmation','confirmed') then raise exception 'Booking cannot be changed'; end if;
 if p_kind='reschedule' then perform validate_session(b.service_id,p_start,p_end,b.attendees); end if;
 if p_kind not in ('cancel','reschedule') or length(trim(p_reason))<3 or length(p_reason)>2000 then raise exception 'Provide a valid change and reason'; end if;
 select * into r from change_requests where booking_id=p_id and state='pending';
 if found then
  if r.kind=p_kind and r.proposed_start is not distinct from p_start and r.proposed_end is not distinct from p_end and r.reason=p_reason then return r; end if;
  raise exception 'A change request is already awaiting review';
 end if;
 insert into change_requests(booking_id,kind,proposed_start,proposed_end,reason) values(p_id,p_kind,p_start,p_end,p_reason) returning * into r; return r;
end; $$;

create function public.review_change(p_id uuid,p_approve boolean,p_expected_total bigint default null) returns bookings language plpgsql security definer set search_path=public as $$
declare r change_requests; b bookings; doc jsonb; cfg settings; subtotal bigint; total bigint; minutes numeric; extra jsonb; lines jsonb; extras text[];
begin
 perform require_staff(); perform expire_reservations(); select * into strict r from change_requests where id=p_id for update;
 select * into strict b from bookings where id=r.booking_id for update;
 if r.state<>'pending' then return b; end if;
 if p_approve then
  if b.booking_state not in ('confirmed','pending_confirmation') then raise exception 'Booking no longer changeable'; end if;
  if r.kind='cancel' then perform transition_booking(b.id,'cancelled');
  else
   doc:=validate_session(b.service_id,r.proposed_start,r.proposed_end,b.attendees); select * into strict cfg from settings;
   minutes:=extract(epoch from(r.proposed_end-r.proposed_start))/60; subtotal:=round((doc->>'hourlyRateMinor')::numeric*minutes/60);
   lines:=jsonb_build_array(jsonb_build_object('label',doc->>'name','amountMinor',subtotal));
   extras:=array(select jsonb_array_elements_text(coalesce(b.price_snapshot->'extraIds','[]')));
   foreach extra in array array(select value from jsonb_array_elements(coalesce(doc->'addons','[]')) where value->>'id'=any(extras)) loop
    if extra->>'status'<>'published' then raise exception 'An extra is no longer available'; end if;
    total:=round((extra->>'amountMinor')::numeric*case when extra->>'basis'='per-hour' then minutes/60 else 1 end);
    subtotal:=subtotal+total; lines:=lines||jsonb_build_array(jsonb_build_object('label',extra->>'name','amountMinor',total));
   end loop;
   if cardinality(extras)<>(select count(*) from jsonb_array_elements(coalesce(doc->'addons','[]')) where value->>'id'=any(extras)) then raise exception 'An extra was removed; review booking first'; end if;
   total:=subtotal+round(subtotal::numeric*cfg.tax_basis_points/10000);
   if p_expected_total is null or p_expected_total<>total then raise exception 'Review updated total before approving: %',total; end if;
   if total<b.paid_minor then raise exception 'Record the required refund before reducing the booking total'; end if;
   delete from allocations where booking_id=b.id;
   perform allocate_booking(b.id,r.proposed_start,r.proposed_end,extras);
   update bookings set starts_at=r.proposed_start,ends_at=r.proposed_end,total_minor=total,price_snapshot=jsonb_build_object('lines',lines||jsonb_build_array(jsonb_build_object('label','Tax','amountMinor',total-subtotal)),'currency',cfg.currency,'taxBasisPoints',cfg.tax_basis_points,'extraIds',extras),payment_state=case when paid_minor>=total then 'paid' else 'unpaid' end,
    expires_at=case when booking_state='pending_confirmation' then least(created_at+interval '24 hours',r.proposed_start) else null end where id=b.id;
   update notification_jobs set state='cancelled' where booking_id=b.id and subject like '%Session reminder%' and state in ('pending','processing');
   if b.booking_state='confirmed' and r.proposed_start>now()+interval '24 hours' then perform queue_booking_email(b.id,'Session reminder',r.proposed_start-interval '24 hours'); end if;
  end if;
 end if;
 update change_requests set state=case when p_approve then 'approved' else 'rejected' end where id=p_id;
 insert into audit_events(booking_id,actor_id,action,details) values(b.id,auth.uid(),'change_reviewed',jsonb_build_object('request',p_id,'approved',p_approve,'oldPrice',b.price_snapshot));
 perform queue_booking_email(b.id,case when p_approve then 'Change approved' else 'Change rejected' end);
 select * into b from bookings where id=b.id; return b;
end; $$;

create function public.submit_enquiry(p_service text,p_name text,p_email text,p_phone text,p_start date,p_end date,p_period text,p_attendees integer,p_message text,p_key uuid default gen_random_uuid()) returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid; begin
 select id into result from enquiries where idempotency_key=p_key and email=lower(trim(p_email)) and customer_id is not distinct from auth.uid(); if found then return result; end if;
 if not exists(select 1 from services where id=p_service and document->>'status'='published') then raise exception 'Service unavailable'; end if;
 if length(trim(p_name))<2 or length(p_name)>200 or p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(p_email)>254 or length(p_phone)>50 or p_start<current_date or p_end<p_start or p_attendees<1 or p_attendees>1000 or length(p_message)>5000 then raise exception 'Check enquiry details'; end if;
 if (select count(*) from enquiries where email=lower(trim(p_email)) and created_at>now()-interval '1 hour')>=5 then raise exception 'Too many enquiries. Please try later.'; end if;
 insert into enquiries(customer_id,service_id,contact_name,email,phone,start_date,end_date,rental_period,attendees,message,idempotency_key) values(auth.uid(),p_service,trim(p_name),lower(trim(p_email)),p_phone,p_start,p_end,p_period,p_attendees,p_message,p_key) returning id into result; return result;
end; $$;

create function public.create_quote(p_enquiry uuid,p_start timestamptz,p_end timestamptz,p_lines jsonb,p_expiry timestamptz,p_instructions text,p_key uuid default gen_random_uuid(),p_extra_ids text[] default '{}') returns quotes language plpgsql security definer set search_path=public as $$
declare e enquiries; q quotes; cfg settings; subtotal bigint; version integer; doc jsonb; extra jsonb; amount bigint; begin
 perform require_staff(); select * into q from quotes where idempotency_key=p_key; if found then if q.enquiry_id<>p_enquiry then raise exception 'Quote retry does not match enquiry'; end if; return q; end if; select * into strict e from enquiries where id=p_enquiry for update;
 if e.customer_id is null then raise exception 'Customer must sign in and submit a linked enquiry before receiving a quote'; end if;
 doc:=validate_session(e.service_id,p_start,p_end,e.attendees,true); select * into strict cfg from settings;
 if p_expiry<=now() or p_expiry>=p_start or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then raise exception 'Invalid quote expiry or lines'; end if;
 if exists(select 1 from jsonb_array_elements(p_lines) x where coalesce(x->>'label','')='' or coalesce(x->>'amountMinor','') !~ '^[0-9]+$') then raise exception 'Quote lines require labels and integer minor amounts'; end if;
 select sum((x->>'amountMinor')::bigint) into subtotal from jsonb_array_elements(p_lines) x;
 if cardinality(p_extra_ids)<>(select count(distinct x) from unnest(p_extra_ids) x) or cardinality(p_extra_ids)<>(select count(*) from jsonb_array_elements(doc->'addons') where value->>'id'=any(p_extra_ids) and value->>'status'='published') then raise exception 'Choose available extras'; end if;
 for extra in select value from jsonb_array_elements(doc->'addons') where value->>'id'=any(p_extra_ids) loop
  amount:=round((extra->>'amountMinor')::numeric*case when extra->>'basis'='per-hour' then extract(epoch from(p_end-p_start))/3600 else 1 end);
  subtotal:=subtotal+amount; p_lines:=p_lines||jsonb_build_array(jsonb_build_object('label',extra->>'name','amountMinor',amount));
 end loop;
 select coalesce(max(qt.version),0)+1 into version from quotes qt where enquiry_id=p_enquiry;
 update quotes set state='superseded' where enquiry_id=p_enquiry and state='offered';
 insert into quotes(enquiry_id,version,idempotency_key,customer_id,service_id,starts_at,ends_at,attendees,lines,extra_ids,subtotal_minor,tax_basis_points,total_minor,expires_at,instructions)
 values(p_enquiry,version,p_key,e.customer_id,e.service_id,p_start,p_end,e.attendees,p_lines,p_extra_ids,subtotal,cfg.tax_basis_points,subtotal+round(subtotal::numeric*cfg.tax_basis_points/10000),p_expiry,p_instructions) returning * into q;
 update enquiries set state='quoted' where id=p_enquiry;
 insert into notification_jobs(dedupe_key,recipient,subject,body) values('quote:'||q.id,e.email,'Creative Collective quote available','Sign in to review your quote. Quotes do not reserve space.'); return q;
end; $$;

create function public.accept_quote(p_id uuid,p_policy_versions jsonb,p_service_ack boolean default false) returns bookings language plpgsql security definer set search_path=public as $$
declare q quotes; b bookings; doc jsonb; p profiles; email text; begin
 select * into strict q from quotes where id=p_id and customer_id=auth.uid() for update;
 if q.state='accepted' then select * into strict b from bookings where id=q.booking_id; return b; end if;
 if q.state<>'offered' or q.expires_at<=now() then raise exception 'Quote expired or superseded'; end if;
 if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Verify your email'; end if;
 if p_policy_versions is null or p_policy_versions<>(select jsonb_object_agg(id,version) from policies where approved) then raise exception 'Accept current policies'; end if;
 perform expire_reservations(); doc:=validate_session(q.service_id,q.starts_at,q.ends_at,q.attendees,true);
 if coalesce(doc->>'acknowledgement','')<>'' and not coalesce(p_service_ack,false) then raise exception 'Accept the service acknowledgement'; end if;
 if cardinality(q.extra_ids)<>(select count(*) from jsonb_array_elements(doc->'addons') where value->>'id'=any(q.extra_ids) and value->>'status'='published') then raise exception 'A quoted extra is no longer available'; end if;
 select * into strict p from profiles where id=auth.uid(); select u.email into email from auth.users u where u.id=p.id;
 if trim(p.full_name)='' or trim(p.phone)='' then raise exception 'Complete your profile'; end if;
 insert into bookings(customer_id,customer_email,customer_name,service_id,service_name,brand,starts_at,ends_at,attendees,total_minor,price_snapshot,policy_snapshot,idempotency_key,expires_at,arrival_instructions,acknowledgement_snapshot)
 values(p.id,email,p.full_name,q.service_id,doc->>'name',doc->>'brand',q.starts_at,q.ends_at,q.attendees,q.total_minor,jsonb_build_object('lines',q.lines||jsonb_build_array(jsonb_build_object('label','Tax','amountMinor',q.total_minor-q.subtotal_minor)),'currency','JMD','quoteId',q.id,'quoteVersion',q.version,'taxBasisPoints',q.tax_basis_points,'extraIds',q.extra_ids),p_policy_versions,q.id,least(now()+interval '24 hours',q.starts_at),coalesce((select document->>'arrivalInstructions' from brands where id=doc->>'brand'),'')||E'\n'||q.instructions,doc->>'acknowledgement') returning * into b;
 perform allocate_booking(b.id,q.starts_at,q.ends_at,q.extra_ids);
 update quotes set state='accepted',booking_id=b.id where id=q.id;
 insert into audit_events(booking_id,actor_id,action) values(b.id,auth.uid(),'quote_accepted'); perform queue_booking_email(b.id,'Reservation submitted'); return b;
end; $$;

create function public.add_note(p_id uuid,p_body text) returns void language plpgsql security definer set search_path=public as $$
begin perform require_staff(); if length(trim(p_body))<1 or length(p_body)>5000 then raise exception 'Invalid note'; end if;
 insert into internal_notes(booking_id,body,actor_id) values(p_id,p_body,auth.uid()); end; $$;
create function public.set_role(p_user uuid,p_role text) returns void language plpgsql security definer set search_path=public as $$
begin if not is_admin() then raise exception 'Administrator required'; end if;
 if p_role not in ('customer','staff','administrator') or p_user=auth.uid() then raise exception 'Invalid role change'; end if;
 update profiles set role=p_role where id=p_user; insert into audit_events(actor_id,action,details) values(auth.uid(),'role_changed',jsonb_build_object('user',p_user,'role',p_role)); end; $$;

-- Default EXECUTE privileges must not expose security-definer internals.
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.is_staff(),public.is_admin() to authenticated;
grant execute on function public.public_catalog(),public.public_policies(),public.available_slots(text,date,integer,text[]),public.submit_enquiry(text,text,text,text,date,date,text,integer,text,uuid) to anon,authenticated;
grant execute on function public.submit_booking(text,timestamptz,integer,integer,uuid,jsonb,text[],uuid,boolean),public.transition_booking(uuid,text),public.record_payment(uuid,bigint,text,text,text,uuid),public.request_change(uuid,text,timestamptz,timestamptz,text),public.review_change(uuid,boolean,bigint),public.create_quote(uuid,timestamptz,timestamptz,jsonb,timestamptz,text,uuid,text[]),public.accept_quote(uuid,jsonb,boolean),public.add_note(uuid,text),public.set_role(uuid,text) to authenticated;
grant execute on all functions in schema public to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('venue-photos','venue-photos',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy photos_read on storage.objects for select using(bucket_id='venue-photos');
create policy photos_admin on storage.objects for all to authenticated using(bucket_id='venue-photos' and public.is_admin()) with check(bucket_id='venue-photos' and public.is_admin());
