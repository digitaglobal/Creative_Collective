create table public.enquiry_followups (
  enquiry_id uuid primary key references public.enquiries(id) on delete cascade,
  owner_id uuid references public.profiles(id),
  follow_up_on date,
  notes text not null default '' check(length(notes)<=5000),
  updated_at timestamptz not null default now()
);
alter table public.enquiry_followups enable row level security;
create policy staff_followups on public.enquiry_followups for select to authenticated
  using (public.is_staff());
grant select on public.enquiry_followups to authenticated;
revoke insert,update,delete on public.enquiry_followups from anon,authenticated;

create function public.save_enquiry_followup(p_id uuid,p_claim boolean,p_due date,p_notes text)
returns void language plpgsql security definer set search_path=public as $$
begin
  perform require_staff();
  perform 1 from enquiries where id=p_id for update;
  if not found then raise exception 'Enquiry unavailable'; end if;
  if p_notes is null or length(p_notes)>5000 then raise exception 'Notes must be at most 5000 characters'; end if;
  insert into enquiry_followups(enquiry_id,owner_id,follow_up_on,notes)
    values(p_id,case when p_claim then auth.uid() else null end,p_due,trim(p_notes))
  on conflict(enquiry_id) do update set
    owner_id=case when p_claim then auth.uid() else enquiry_followups.owner_id end,
    follow_up_on=p_due,notes=trim(p_notes),updated_at=now();
  insert into audit_events(actor_id,action,details) values(auth.uid(),'enquiry_followup_saved',jsonb_build_object('enquiry',p_id));
end; $$;
revoke execute on function public.save_enquiry_followup(uuid,boolean,date,text) from public,anon;
grant execute on function public.save_enquiry_followup(uuid,boolean,date,text) to authenticated;
