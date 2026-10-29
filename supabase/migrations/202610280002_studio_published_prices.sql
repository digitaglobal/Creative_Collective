-- Source: https://createatstudiod.com/prices/ (28 October 2026).
-- Use the repeated desktop pricing section; duplicate responsive markup has
-- inconsistent labels. Equipment, tax, capacity and inventory remain pending.
update public.services set document = document || jsonb_build_object(
 'publishedPrices', '[{"label":"Hourly","amountMinor":850000},{"label":"Daily (12 hours)","amountMinor":9000000}]'::jsonb
) where id='svc-studio-rental';

update public.services set document = document || jsonb_build_object(
 'description', 'Space-only lounge rental. The published daily rate covers 12 hours and is listed for reference.',
 'publishedPrices', '[{"label":"Hourly","amountMinor":500000},{"label":"Daily (12 hours)","amountMinor":2500000}]'::jsonb
) where id='svc-studio-lounge';

update public.services set document = document || jsonb_build_object(
 'publishedPrices', '[{"label":"Hourly","amountMinor":500000},{"label":"Daily","amountMinor":2500000}]'::jsonb
) where id='svc-studio-recording-booth';

-- Do not enable reservations, approve services, or change the unpriced podcast setup.
