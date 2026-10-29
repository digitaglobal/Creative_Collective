-- Serialize retries for the same customer and idempotency key before checking
-- for an existing booking. Resource exclusion constraints still arbitrate
-- different requests competing for the same room or equipment.
do $$ declare definition text; begin
 select pg_get_functiondef('public.submit_booking(text,timestamptz,integer,integer,uuid,jsonb,text[],uuid,boolean)'::regprocedure) into definition;
 if position('select * into b from bookings where customer_id=who and idempotency_key=p_key;' in definition)=0 then raise exception 'Booking retry lookup changed; review migration'; end if;
 definition:=replace(definition,
 'select * into b from bookings where customer_id=who and idempotency_key=p_key;',
 'perform pg_advisory_xact_lock(hashtextextended(who::text || '':'' || p_key::text, 0));
 select * into b from bookings where customer_id=who and idempotency_key=p_key;');
 execute definition;
end $$;
