# Availability week picker

Service pages offer seven-day comparisons within the configured booking horizon, a date picker, and previous/next controls. Changing dates clears the selected start, retaining duration, attendees and extras. Each day queries the existing authoritative available_slots function using the current duration/extras; the selected date shares the query cache. Results refresh every 30 seconds.

Available labels count valid start times, not independent spaces. Fully booked requires every returned start to report Already reserved. Closed is used for approved Sunday closure or all starts reporting closure; No times covers other constraints such as notice limits or sessions that do not fit. Failed requests show Check failed with retry, never Closed or Fully booked.

Pending venue configuration shows planning dates labelled Setup pending and does not request live slots. The selected date carries into enquiries. No business approval, email delivery or payment settings change.

Start-time buttons are at least 44px tall and show selected state. The summary includes the selected date and time. The existing checked nearby-date alternatives remain available when a selected date has no valid starts. Selection is rechecked on submission and does not hold space.
