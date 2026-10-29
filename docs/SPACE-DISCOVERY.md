# Space discovery and comparison

`/spaces` provides one catalog for Enigma and Studio D, linked from the homepage and desktop/mobile navigation. Purpose, venue, group size and up to three comparison IDs live in URL query parameters so refresh and shared links preserve them. Changing or clearing filters does not remove comparison selections; a separate control clears the comparison.

Only explicitly mapped spaces appear. Ancillary services such as printing, lockers and equipment rentals remain in venue catalogs. Add new space IDs to `src/lib/space-discovery.ts` when introducing another room or workspace. Group-size filtering uses listed capacity and explicitly requires venue confirmation; it is not a live availability check.

Cards and comparison use the existing public catalog, image mapping, period-labeled prices and inclusion lists. No tax is invented and no draft data is approved. Missing rates remain pending. The mobile comparison table scrolls independently and supports keyboard focus. Detail/enquiry links lead to the existing service page.

No database migration, business-setting change, email work or payment integration is included. Validation covers combined filters, non-space exclusion, unknown/duplicate comparison IDs, three-space limits, reload persistence, empty results, detail links and mobile overflow, alongside the existing booking browser suite.
