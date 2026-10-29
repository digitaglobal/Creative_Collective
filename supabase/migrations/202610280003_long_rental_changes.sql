alter table change_requests add column revised_subtotal_minor bigint check(revised_subtotal_minor>=0),
 add column revised_total_minor bigint check(revised_total_minor>=0),
 add column revised_tax_basis_points integer,
 add column price_accepted_at timestamptz;

do $$ declare d text; begin
 select pg_get_functiondef('public.request_change(uuid,text,timestamptz,timestamptz,text)'::regprocedure) into d;
 d:=replace(d,'perform validate_session(b.service_id,p_start,p_end,b.attendees);',
 'perform validate_session(b.service_id,p_start,p_end,b.attendees,b.price_snapshot ? ''quoteId'' or exists(select 1 from jsonb_array_elements(b.price_snapshot->''lines'') x where x->>''label''=''Long rental''));');
 execute d;
end $$;

create function public.offer_rental_change(p_id uuid,p_subtotal bigint) returns void language plpgsql security definer set search_path=public as $$
declare r change_requests; b bookings; tax integer; begin
 perform require_staff();
 select * into strict r from change_requests where id=p_id for update;
 select * into strict b from bookings where id=r.booking_id for update;
 if r.state<>'pending' or r.kind<>'reschedule' or b.booking_state not in ('confirmed','pending_confirmation') then raise exception 'Change is no longer available'; end if;
 if not (b.price_snapshot ? 'quoteId' or exists(select 1 from jsonb_array_elements(b.price_snapshot->'lines') x where x->>'label'='Long rental')) then raise exception 'Only quoted rentals require a revised offer'; end if;
 perform validate_session(b.service_id,r.proposed_start,r.proposed_end,b.attendees,true);
 select tax_basis_points into strict tax from settings;
 if p_subtotal is null or p_subtotal<0 or p_subtotal>100000000000 then raise exception 'Enter a valid rental subtotal'; end if;
 update change_requests set revised_subtotal_minor=p_subtotal,revised_tax_basis_points=tax,
 revised_total_minor=p_subtotal+round(p_subtotal::numeric*tax/10000),price_accepted_at=null where id=p_id;
 insert into audit_events(booking_id,actor_id,action,details) values(b.id,auth.uid(),'rental_change_offered',jsonb_build_object('request',p_id,'subtotalMinor',p_subtotal));
end $$;

create function public.accept_rental_change(p_id uuid,p_expected_total bigint) returns void language plpgsql security definer set search_path=public as $$
declare r change_requests; b bookings; begin
 select * into strict r from change_requests where id=p_id for update;
 select * into strict b from bookings where id=r.booking_id and customer_id=auth.uid() for update;
 if r.state<>'pending' or r.kind<>'reschedule' or b.booking_state not in ('confirmed','pending_confirmation') or r.revised_total_minor is null or p_expected_total is distinct from r.revised_total_minor then raise exception 'Review the current rental offer'; end if;
 perform validate_session(b.service_id,r.proposed_start,r.proposed_end,b.attendees,true);
 update change_requests set price_accepted_at=now() where id=p_id;
 insert into audit_events(booking_id,actor_id,action,details) values(b.id,auth.uid(),'rental_change_accepted',jsonb_build_object('request',p_id,'totalMinor',r.revised_total_minor));
end $$;

alter function public.preview_change(uuid) rename to preview_hourly_change;
revoke execute on function public.preview_hourly_change(uuid) from public,anon,authenticated,service_role;
create function public.preview_change(p_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare r change_requests; b bookings; begin
 perform require_staff(); select * into strict r from change_requests where id=p_id;
 select * into strict b from bookings where id=r.booking_id;
 if r.kind='reschedule' and (b.price_snapshot ? 'quoteId' or exists(select 1 from jsonb_array_elements(b.price_snapshot->'lines') x where x->>'label'='Long rental')) then
  return jsonb_build_object('requiresOffer',true,'totalMinor',r.revised_total_minor,'accepted',r.price_accepted_at is not null,'differenceMinor',r.revised_total_minor-b.total_minor,'refundRequiredMinor',greatest(0,b.paid_minor-r.revised_total_minor));
 end if;
 return preview_hourly_change(p_id);
end $$;

alter function public.review_change(uuid,boolean,bigint) rename to review_hourly_change;
revoke execute on function public.review_hourly_change(uuid,boolean,bigint) from public,anon,authenticated,service_role;
create function public.review_change(p_id uuid,p_approve boolean,p_expected_total bigint default null) returns bookings language plpgsql security definer set search_path=public as $$
declare r change_requests; b bookings; extras text[]; begin
 perform require_staff(); perform expire_reservations();
 if p_approve is null then raise exception 'Choose approval or rejection'; end if;
 select * into strict r from change_requests where id=p_id for update;
 select * into strict b from bookings where id=r.booking_id for update;
 if not p_approve or r.kind='cancel' or not (b.price_snapshot ? 'quoteId' or exists(select 1 from jsonb_array_elements(b.price_snapshot->'lines') x where x->>'label'='Long rental')) then return review_hourly_change(p_id,p_approve,p_expected_total); end if;
 if r.state<>'pending' then return b; end if;
 if b.booking_state not in ('confirmed','pending_confirmation') then raise exception 'Booking no longer changeable'; end if;
 if r.price_accepted_at is null or r.revised_total_minor is null or p_expected_total is distinct from r.revised_total_minor then raise exception 'Customer must accept the current revised total'; end if;
 if b.paid_minor>r.revised_total_minor then raise exception 'Record the required refund before reducing the booking total'; end if;
 perform validate_session(b.service_id,r.proposed_start,r.proposed_end,b.attendees,true);
 extras:=array(select jsonb_array_elements_text(coalesce(b.price_snapshot->'extraIds','[]')));
 if cardinality(extras)<>(select count(*) from services s,jsonb_array_elements(s.document->'addons') x where s.id=b.service_id and x->>'id'=any(extras) and x->>'status'='published') then raise exception 'A rental extra is no longer available'; end if;
 delete from allocations where booking_id=b.id;
 perform allocate_booking(b.id,r.proposed_start,r.proposed_end,extras);
 update bookings set starts_at=r.proposed_start,ends_at=r.proposed_end,total_minor=r.revised_total_minor,
 price_snapshot=price_snapshot||jsonb_build_object('lines',jsonb_build_array(jsonb_build_object('label','Long rental','amountMinor',r.revised_subtotal_minor),jsonb_build_object('label','Tax','amountMinor',r.revised_total_minor-r.revised_subtotal_minor)),'taxBasisPoints',r.revised_tax_basis_points,'changeRequestId',r.id),
 payment_state=case when paid_minor>=r.revised_total_minor then 'paid' else 'unpaid' end,
 expires_at=case when booking_state='pending_confirmation' then least(created_at+interval '24 hours',r.proposed_start) else null end where id=b.id;
 update notification_jobs set state='cancelled' where booking_id=b.id and subject like '%Session reminder%' and state in ('pending','processing');
 if b.booking_state='confirmed' and r.proposed_start>now()+interval '24 hours' then perform queue_booking_email(b.id,'Session reminder',r.proposed_start-interval '24 hours'); end if;
 update change_requests set state='approved' where id=r.id;
 insert into audit_events(booking_id,actor_id,action,details) values(b.id,auth.uid(),'change_reviewed',jsonb_build_object('request',r.id,'approved',true,'oldPrice',b.price_snapshot));
 perform queue_booking_email(b.id,'Change approved');
 select * into strict b from bookings where id=b.id; return b;
end $$;

revoke execute on function public.offer_rental_change(uuid,bigint),public.accept_rental_change(uuid,bigint),public.preview_change(uuid),public.review_change(uuid,boolean,bigint) from public,anon;
grant execute on function public.offer_rental_change(uuid,bigint),public.accept_rental_change(uuid,bigint),public.preview_change(uuid),public.review_change(uuid,boolean,bigint) to authenticated,service_role;
