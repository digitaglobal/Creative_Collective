alter table policies add constraint known_policy check(id in ('cancellation','refund','no_show','late_arrival','house_rules','privacy','terms'));
alter table services add constraint service_document_identity check(document->>'id'=id and document->>'brand'=brand and document->>'slug'=slug);
alter table brands add constraint brand_document_identity check(document->>'slug'=id);

create or replace function public.public_catalog() returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('brands',coalesce((select jsonb_agg(document) from brands),'[]'::jsonb),
 'services',coalesce((select jsonb_agg(document || jsonb_build_object('bookableHourly',approved and coalesce((document->>'bookableHourly')::boolean,false) and exists(select 1 from service_resources sr where sr.service_id=s.id) and not exists(select 1 from service_resources sr join resources r on r.id=sr.resource_id where sr.service_id=s.id and not r.approved)) || jsonb_build_object('resourceIds',coalesce((select jsonb_agg(resource_id) from service_resources where service_id=s.id),'[]'::jsonb))) from services s where document->>'status'='published'),'[]'::jsonb),
 'rules',jsonb_build_object('horizonDays',horizon_days,'advanceNoticeHours',advance_notice_hours),
 'taxBasisPoints',tax_basis_points,
 'hours',jsonb_build_object('weekdayOpen',weekday_open,'weekdayClose',weekday_close,'saturdayOpen',saturday_open,'saturdayClose',saturday_close,'sundayClosed',sunday_closed),
 'ready',launch_approved and tax_basis_points is not null and (select count(*)=7 and bool_and(approved) from policies)) from settings;
$$;

create function public.preview_change(p_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare r change_requests; b bookings; doc jsonb; cfg settings; minutes numeric; subtotal bigint; total bigint; extra jsonb; lines jsonb; extras text[];
begin
 perform require_staff(); select * into strict r from change_requests where id=p_id; select * into strict b from bookings where id=r.booking_id;
 if r.kind='cancel' then return jsonb_build_object('totalMinor',b.total_minor,'differenceMinor',0); end if;
 doc:=validate_session(b.service_id,r.proposed_start,r.proposed_end,b.attendees); select * into strict cfg from settings;
 minutes:=extract(epoch from(r.proposed_end-r.proposed_start))/60;
 subtotal:=round((doc->>'hourlyRateMinor')::numeric*minutes/60);
 lines:=jsonb_build_array(jsonb_build_object('label',doc->>'name','amountMinor',subtotal));
 extras:=array(select jsonb_array_elements_text(coalesce(b.price_snapshot->'extraIds','[]')));
 foreach extra in array array(select value from jsonb_array_elements(coalesce(doc->'addons','[]')) where value->>'id'=any(extras)) loop
  if extra->>'status'<>'published' then raise exception 'An extra is no longer available'; end if;
  total:=round((extra->>'amountMinor')::numeric*case when extra->>'basis'='per-hour' then minutes/60 else 1 end);
  subtotal:=subtotal+total; lines:=lines||jsonb_build_array(jsonb_build_object('label',extra->>'name','amountMinor',total));
 end loop;
 if cardinality(extras)<>(select count(*) from jsonb_array_elements(coalesce(doc->'addons','[]')) where value->>'id'=any(extras)) then raise exception 'An extra was removed'; end if;
 total:=subtotal+round(subtotal::numeric*cfg.tax_basis_points/10000);
 return jsonb_build_object('totalMinor',total,'differenceMinor',total-b.total_minor,'refundRequiredMinor',greatest(0,b.paid_minor-total),'lines',lines||jsonb_build_array(jsonb_build_object('label','Tax','amountMinor',total-subtotal)));
end; $$;
revoke execute on function public.preview_change(uuid) from public,anon,authenticated;
grant execute on function public.preview_change(uuid) to authenticated,service_role;

create function public.audit_configuration() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_table_name='policies' and tg_op='UPDATE' then
  if (new.body<>old.body or new.title<>old.title) and new.version<=old.version then raise exception 'Increase the policy version when changing wording'; end if;
 end if;
 insert into audit_events(actor_id,action,details) values(auth.uid(),'configuration_'||lower(tg_op),jsonb_build_object('table',tg_table_name,'before',case when tg_op<>'INSERT' then to_jsonb(old) else null end,'after',case when tg_op<>'DELETE' then to_jsonb(new) else null end));
 if tg_op='DELETE' then return old; else return new; end if;
end; $$;
do $$ declare t text; begin foreach t in array array['settings','brands','services','resources','service_resources','extra_resources','closures','policies'] loop
 execute format('create trigger audit_configuration after insert or update or delete on %I for each row execute function audit_configuration()',t);
end loop; end $$;
revoke execute on function public.audit_configuration() from public,anon,authenticated;

create function public.retry_notification(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin perform require_staff();
 update notification_jobs set state='pending',attempts=0,due_at=now(),locked_at=null where id=p_id and state='failed';
 insert into audit_events(actor_id,action,details) values(auth.uid(),'notification_retried',jsonb_build_object('job',p_id));
end; $$;
revoke execute on function public.retry_notification(uuid) from public,anon,authenticated;
grant execute on function public.retry_notification(uuid) to authenticated,service_role;
