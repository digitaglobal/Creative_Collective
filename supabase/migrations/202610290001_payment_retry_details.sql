-- A retry must describe the same ledger transaction, including its receipt.
do $$ declare definition text; begin
 select pg_get_functiondef('public.record_payment(uuid,bigint,text,text,text,uuid)'::regprocedure) into definition;
 if position('prior.booking_id<>p_id or prior.amount_minor<>p_amount or prior.kind<>p_kind' in definition)=0 then raise exception 'Payment retry validation changed; review migration'; end if;
 definition:=replace(definition,
 'prior.booking_id<>p_id or prior.amount_minor<>p_amount or prior.kind<>p_kind',
 'prior.booking_id is distinct from p_id or prior.amount_minor is distinct from p_amount or prior.kind is distinct from p_kind or prior.method is distinct from p_method or prior.reference is distinct from p_reference');
 definition:=replace(definition,
 'if p_amount is null or p_amount<=0 or p_kind not in',
 'if p_key is null or p_method is null or p_reference is null or p_kind is null or p_amount is null or p_amount<=0 or p_kind not in');
 execute definition;
end $$;
