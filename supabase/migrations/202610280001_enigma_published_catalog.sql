-- Source: https://enigmacoworking.com/pricing/ (28 October 2026).
-- Existing published rates match the source. Do not approve inventory or launch.
update public.brands set document = document || '{"openingHours":{"monday":{"open":"08:00","close":"17:00"},"tuesday":{"open":"08:00","close":"17:00"},"wednesday":{"open":"08:00","close":"17:00"},"thursday":{"open":"08:00","close":"17:00"},"friday":{"open":"08:00","close":"16:00"},"saturday":null,"sunday":null}}'::jsonb where id='enigma';

insert into public.services(id,brand,slug,document,approved) values (
 'svc-enigma-hot-desk','enigma','hot-desk',
 '{"id":"svc-enigma-hot-desk","slug":"hot-desk","brand":"enigma","name":"Hot desk — The Sandbox","useCase":"Flexible individual workspace","description":"Single hot desk in The Sandbox. Inventory and reservation rules await confirmation.","resourceIds":[],"maxAttendees":1,"hourlyRateMinor":100000,"publishedPrices":[{"label":"Hourly","amountMinor":100000},{"label":"Daily","amountMinor":500000},{"label":"Weekly","amountMinor":1500000},{"label":"Monthly","amountMinor":3750000}],"bookableHourly":false,"minDurationMinutes":60,"maxDurationMinutes":480,"stepMinutes":30,"status":"published","content":{"included":["Single hot desk"],"not-included":["Tax"],"bring":[]},"facilitiesStatus":"Inventory, accessibility and booking duration rules pending confirmation","addons":[],"imageAlt":"Enigma Sandbox hot desk"}'::jsonb, false
);

create function public.service_day_hours(p_service text,p_date date)
returns table(opens time, closes time) language plpgsql stable security definer set search_path=public as $$
declare schedule jsonb; day jsonb; cfg settings;
begin
 select b.document->'openingHours' into schedule from services s join brands b on b.id=s.brand where s.id=p_service;
 if schedule is not null then
  day:=schedule->(array['sunday','monday','tuesday','wednesday','thursday','friday','saturday'])[extract(dow from p_date)::integer+1];
  return query select (day->>'open')::time,(day->>'close')::time;
 else
  select * into strict cfg from settings;
  if extract(dow from p_date)=0 and cfg.sunday_closed then return query select null::time,null::time;
  else return query select case when extract(dow from p_date)=6 then cfg.saturday_open else cfg.weekday_open end,case when extract(dow from p_date)=6 then cfg.saturday_close else cfg.weekday_close end;
  end if;
 end if;
end; $$;
revoke execute on function public.service_day_hours(text,date) from public,anon,authenticated;

-- Preserve the existing booking validation and conflict logic, changing only hours.
do $$ declare definition text; begin
 select pg_get_functiondef('public.validate_session(text,timestamptz,timestamptz,integer,boolean)'::regprocedure) into definition;
 definition:=replace(definition,'if extract(dow from local_start)=0 and cfg.sunday_closed then raise exception ''Venue closed''; end if;','');
 definition:=replace(definition,'opening:=case when extract(dow from local_start)=6 then cfg.saturday_open else cfg.weekday_open end;', 'select opens,closes into opening,closing from service_day_hours(p_service,local_start::date); if opening is null or closing is null then raise exception ''Opening hours pending confirmation or venue closed''; end if;');
 definition:=replace(definition,'closing:=case when extract(dow from local_start)=6 then cfg.saturday_close else cfg.weekday_close end;','');
 execute definition;
 select pg_get_functiondef('public.available_slots(text,date,integer,text[])'::regprocedure) into definition;
 definition:=replace(definition,'if extract(dow from p_date)=0 and cfg.sunday_closed then return ''[]''; end if;','');
 definition:=replace(definition,'opening:=case when extract(dow from p_date)=6 then cfg.saturday_open else cfg.weekday_open end;', 'select opens,closes into opening,closing from service_day_hours(p_service,p_date); if opening is null or closing is null then return ''[]''; end if;');
 definition:=replace(definition,'closing:=case when extract(dow from p_date)=6 then cfg.saturday_close else cfg.weekday_close end;','');
 execute definition;
end; $$;
