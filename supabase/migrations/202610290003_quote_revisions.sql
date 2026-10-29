create table public.quote_revisions (
  quote_id uuid primary key references public.quotes(id),
  enquiry_id uuid not null references public.enquiries(id),
  customer_id uuid not null references public.profiles(id),
  message text not null check(length(message) between 10 and 2000),
  created_at timestamptz not null default now()
);
alter table public.quote_revisions enable row level security;
revoke all on public.quote_revisions from anon,authenticated;
grant select on public.quote_revisions to authenticated;
create policy revision_read on public.quote_revisions for select to authenticated
using(customer_id=auth.uid() or public.is_staff());

create function public.request_quote_revision(p_id uuid,p_message text) returns uuid
language plpgsql security definer set search_path=public as $$
declare q quotes; enquiry uuid; previous quote_revisions;
begin
  if auth.uid() is null then raise exception 'Sign in to request a revision' using errcode='42501'; end if;
  if p_message is null or length(trim(p_message))<10 or length(trim(p_message))>2000 then raise exception 'Describe the changes in 10 to 2000 characters'; end if;
  select enquiry_id into enquiry from quotes where id=p_id and customer_id=auth.uid();
  if enquiry is null then raise exception 'Quote unavailable' using errcode='42501'; end if;
  -- Match create_quote's lock order; acceptance locks the quote and is serialized here.
  perform 1 from enquiries where id=enquiry for update;
  select * into strict q from quotes where id=p_id and customer_id=auth.uid() for update;
  select * into previous from quote_revisions where quote_id=p_id;
  if found then
    if previous.message<>trim(p_message) then raise exception 'A revision request already exists for this version'; end if;
    return p_id;
  end if;
  if q.state<>'offered' then raise exception 'Only an unaccepted current quote can be revised'; end if;
  insert into quote_revisions(quote_id,enquiry_id,customer_id,message) values(q.id,q.enquiry_id,auth.uid(),trim(p_message));
  update quotes set state='superseded' where id=q.id;
  update enquiries set state='reviewing' where id=q.enquiry_id;
  return q.id;
end;
$$;
revoke all on function public.request_quote_revision(uuid,text) from public,anon;
grant execute on function public.request_quote_revision(uuid,text) to authenticated;
