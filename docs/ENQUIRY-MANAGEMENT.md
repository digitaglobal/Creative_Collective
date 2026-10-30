# Staff enquiry management

Staff can search customers and references, filter by enquiry status, and choose assigned-to-me, unassigned-open or follow-up-due queues. Closed enquiries are excluded from unassigned and due queues.

Open Staff follow-up on an enquiry to claim it, set or clear a Jamaica follow-up date, and save internal handover notes. Claiming explicitly assigns it to the current staff member; otherwise its existing owner is preserved. Notes are staff-only through row-level security and a staff-checked save RPC. Saving does not email the customer. Existing quote preparation and account linking remain available.

Migration: 202610300001_enquiry_followup.sql (applied to hosted database).

Validation: typecheck and production build passed; mobile enquiry-to-quote browser test covers ownership, due filtering, persistence and no horizontal overflow.

Business details, emails, online payments and the broader accessibility audit remain pending.
