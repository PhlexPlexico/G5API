# Changelog

All notable changes to G5API are documented here.

Image tags follow the release flow: `next` tracks every push to `master`, and a
version tag (e.g. `V2.3.0.0`) publishes `latest` alongside the version number.

## [2.3.0.0] - 2026-09-03

### Added

- **Challonge API v2.1 support.** The integration is now a typed `Challonge`
  client that speaks v2.1 by default, replacing four scattered copies of
  hand-built v1 URLs. v2.1 accepts the existing v1 API key through the
  `Authorization-Type: v1` header, so no OAuth2 onboarding, schema migration, or
  user action is required — and the key no longer travels in a query string.
  Set `server.challongeApiVersion` to `v1` to roll back without a redeploy.
- Community (subdomain) tournaments are now addressed correctly. v2.1 returns
  404 for any tournament under a Challonge subdomain unless the community is
  passed as `community_id`, even by numeric ID. Tournament identifiers may be
  given as a bare slug, a numeric ID, the v1 `subdomain-slug` form, or a full
  bracket URL.
- Team and player import handles both roster sources: v2.1's `misc` field, with
  a fallback to a v1 participants call for brackets that still keep Steam IDs in
  custom registration fields (v2.1 drops `custom_field_response` entirely).
- `src/types/challonge/` type definitions, replacing the `any` casts throughout
  the Challonge path.
- Hermetic unit tests for the Challonge client (`yarn test:challonge`).

### Fixed

- **Challonge team import inserted duplicates.** Importing N participants
  inserted 1+2+…+N teams, because the insert ran inside the accumulation loop.
  It is now a single statement, and re-running an import skips participants
  already imported.
- **Every imported player was flagged captain.** The `firstPlayer` flag was
  declared inside the loop, so it reset on each iteration. Only the first player
  is captain now.
- **Tournament finalize could never fire.** The guard was `if (!challongeData)`,
  which is false for an empty array, and the URL was missing a slash
  (`…/tournaments/{slug}finalize.json`). Seasons attached to a Challonge bracket
  were therefore never closed.
- Challonge imports responded before their database inserts finished
  (`forEach(async …)` was never awaited).
- Non-2xx Challonge responses were parsed as success. They now raise
  `ChallongeApiError`, which never carries the API key.
- The team-import API key guard ran after the key had already been interpolated
  into the request URL.
- The Bo1 `map_stats` lookup had no ordering, so an arbitrary row could be
  reported as the match score.
- v2.1 paginates participants and matches; the client now follows every page
  instead of silently truncating large brackets at the first page.
- Adjusted the database class to cast query arguments to `QueryValues`, fixing
  compilation against current mysql2 typings (#6e56e82).

### Changed

- CI publishes `next` on every push to `master`, and publishes `latest` plus the
  version number only from a release tag. Feature branches no longer publish
  images.

### Dependencies

Security and maintenance updates merged since 2.2.0.0:

| Package | From | To |
| --- | --- | --- |
| @babel/core | 7.28.4 | 7.29.7 |
| axios | 1.13.5 | 1.18.1 |
| basic-ftp | 5.2.0 | 5.3.1 |
| body-parser | 1.20.4 | 1.20.6 |
| brace-expansion | 1.1.13 | 1.1.18 |
| browserslist | 4.26.3 | 4.28.8 |
| follow-redirects | 1.15.11 | 1.16.0 |
| form-data | 4.0.4 | 4.0.6 |
| ip-address | 10.0.1 | 10.4.0 |
| linkify-it | 5.0.1 | 5.0.2 |
| lodash | 4.17.23 | 4.18.1 |
| markdown-it | 14.1.0 | 14.2.0 |
| morgan | 1.10.1 | 1.11.0 |
| mysql2 | 3.15.1 | 3.23.1 |
| pm2 | 5.4.3 | 7.0.0 |
| systeminformation | 5.31.1 | 5.31.17 |

> **pm2 5 → 7 is a major version bump.** If you deploy with `yarn startprod` /
> `yarn restartprod`, review the pm2 upgrade notes before rolling out.

[2.3.0.0]: https://github.com/PhlexPlexico/G5API/compare/V2.2.0.0...V2.3.0.0
