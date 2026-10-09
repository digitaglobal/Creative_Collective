-- Validate editable documents before they can break availability or publish rates.
create function public.check_service_document() returns trigger language plpgsql set search_path=public as $$
declare d jsonb:=new.document; extra jsonb; price jsonb;
begin
 if coalesce(d->>'name','')='' or d->>'status' not in ('draft','published') or new.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'Service name, URL name and publication status are required'; end if;
 if coalesce((d->>'maxAttendees')::integer,0)<1 or coalesce((d->>'stepMinutes')::integer,0)<1 or coalesce((d->>'minDurationMinutes')::integer,0)<1 or (d->>'maxDurationMinutes')::integer<(d->>'minDurationMinutes')::integer or (d->>'maxDurationMinutes')::integer>480 then raise exception 'Check capacity and duration settings'; end if;
 if d->>'hourlyRateMinor' is not null and ((d->>'hourlyRateMinor')::numeric<0 or (d->>'hourlyRateMinor') !~ '^[0-9]+$') then raise exception 'Hourly price must be a non-negative integer minor amount'; end if;
 if jsonb_typeof(d->'addons')<>'array' or jsonb_typeof(d->'publishedPrices')<>'array' then raise exception 'Prices and extras must be lists'; end if;
 if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(d->'addons')) then raise exception 'Extra identifiers must be unique'; end if;
 for extra in select value from jsonb_array_elements(d->'addons') loop
  if coalesce(extra->>'id','')='' or coalesce(extra->>'name','')='' or extra->>'basis' not in ('per-booking','per-hour') or extra->>'status' not in ('draft','published') or coalesce(extra->>'amountMinor','') !~ '^[0-9]+$' then raise exception 'Check extra names, prices and availability'; end if;
 end loop;
 for price in select value from jsonb_array_elements(d->'publishedPrices') loop
  if coalesce(price->>'label','')='' or coalesce(price->>'amountMinor','') !~ '^[0-9]+$' then raise exception 'Published prices require a rental period and non-negative amount'; end if;
 end loop;
 return new;
end; $$;
create trigger check_service_document before insert or update on services for each row execute function check_service_document();
revoke execute on function public.check_service_document() from public,anon,authenticated;

create function public.check_extra_mapping() returns trigger language plpgsql set search_path=public as $$
begin
 if not exists(select 1 from services s, jsonb_array_elements(s.document->'addons') x where s.id=new.service_id and x->>'id'=new.extra_id) then raise exception 'Choose an extra belonging to the selected service'; end if;
 return new;
end; $$;
create trigger check_extra_mapping before insert or update on extra_resources for each row execute function check_extra_mapping();
revoke execute on function public.check_extra_mapping() from public,anon,authenticated;
