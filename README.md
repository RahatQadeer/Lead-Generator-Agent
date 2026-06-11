# LeadForge — AI Lead Generation Platform

AI-powered sales assistant that automates prospecting, contact discovery, and personalized outreach.

## Tech Stack

- **Next.js 16** (App Router)
- **React 19**
- **Supabase** (Auth + Database)
- **Tailwind CSS 4**

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

### 3. Supabase setup

1. Create a [Supabase](https://supabase.com) project
2. Run the migration in `supabase/migrations/001_profiles.sql` via the SQL Editor
3. Enable **Google** provider under **Authentication → Providers**
4. Add redirect URL: `http://localhost:3000/auth/callback`
5. Configure Google OAuth credentials in [Google Cloud Console](https://console.cloud.google.com):
   - Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to login.

## AUTH-001 — Google OAuth

| Criteria | Implementation |
|----------|----------------|
| Google login button | `/login` page with "Continue with Google" |
| Redirect to dashboard | OAuth callback → `/dashboard` |
| User session | Supabase SSR cookies via middleware |
| User profile stored | `profiles` table + trigger on signup |
| Logout | Sign out button in dashboard header |
| Invalid login handled | Error banner on `/login` with friendly messages |

## SEARCH-001 — Search Criteria Engine

| Criteria | Field |
|----------|-------|
| Industry | Dropdown select |
| Company size | Presets + min/max employees |
| Country | Dropdown select |
| Keywords | Tag input |
| Technologies | Tag input with suggestions |
| Job titles | Tag input with suggestions (required) |

Run migration `supabase/migrations/002_searches.sql` in the Supabase SQL Editor.

## SEARCH-002 — Search Builder UI

| Criteria | Implementation |
|----------|----------------|
| Create search | 3-step builder form with server action |
| Edit search | Click pencil on a saved search → form pre-fills → Save changes |
| Validation | Client + server validation with per-field error messages |

## DISC-001 — Company Discovery Provider

| Criteria | Implementation |
|----------|----------------|
| Fetch companies | `POST /api/companies/discover` with `searchId` |
| Pagination | `page` + `perPage` params; `hasMore` in response |
| Retry support | 3 attempts with exponential backoff on retryable errors |
| Error handling | Typed errors: rate limit, auth, network, provider |

**Providers:** `mock` (default) or `apollo` (set `COMPANY_DATA_PROVIDER=apollo` + `APOLLO_API_KEY`).

**Apollo plan requirement:** Organization search (`/mixed_companies/search`) is only available on **paid** Apollo plans. Free plans and trials return `403` with `API_INACCESSIBLE` even when the API key is valid. Use `COMPANY_DATA_PROVIDER=mock` for local development until you upgrade at [app.apollo.io](https://app.apollo.io/).

### Testing DISC-001

1. Set `COMPANY_DATA_PROVIDER=mock` in `.env.local`
2. Go to **Searches** → expand a saved search → click **Discover companies**
3. Mock returns healthcare companies matching criteria
4. Click **Load next page** to test pagination
5. For Apollo: upgrade to a paid plan, create a Master API key (Settings → Integrations → API), set provider + key, restart dev server, run discovery again

```bash
# API test (while logged in — use browser session cookie)
curl -X POST http://localhost:3000/api/companies/discover \
  -H "Content-Type: application/json" \
  -d '{"searchId":"<your-search-uuid>","page":1,"perPage":10}'
```

## DISC-002 — Company Filtering Engine

| Filter | Match rule |
|--------|------------|
| Industry | Case-insensitive exact match on `company.industry` |
| Size | `employeeCount` within `companySizeMin`–`companySizeMax` (unknown size passes) |
| Country | Normalized location match on `company.country` |
| Technology | All listed technologies must match via `technologies` field or name/domain/industry text |

**Pipeline:** provider fetch → `applyCriteria` (inclusion) → `applyExclusions` (negative rules).

**Module:** `src/lib/company-discovery/apply-criteria.ts` — shared by mock provider (pre-pagination) and discovery orchestrator (post-fetch safety net for Apollo).

### Testing DISC-002

1. Create a search with industry, country, size, and technology filters (e.g. Healthcare, United States, 201–500, React)
2. Expand the search card → **Discover companies**
3. Mock data returns only companies matching all four filters
4. Add exclusion rules (SEARCH-004) to verify exclusion count appears separately from criteria filtering

## DISC-003 — Duplicate Company Detection

| Detection | Rule |
|-----------|------|
| Identity key | Normalized `domain` (primary), or `name + country` fallback |
| In-batch | Duplicate domains/names within the same discovery response are skipped |
| Cross-search | Companies already saved for the user are skipped as known duplicates |

**Pipeline:** provider fetch → `applyCriteria` → `applyExclusions` → `applyDedup` → persist new companies.

**Persistence:** `supabase/migrations/004_companies.sql` — `companies` table with unique `(user_id, dedup_key)`.

Run migration `004_companies.sql` in the Supabase SQL Editor before testing cross-search dedup.

### Testing DISC-003

1. Run migration `004_companies.sql`
2. Discover companies on a search — results are saved to `companies`
3. Run discovery again on the same or a different search with overlapping companies
4. UI shows `duplicates skipped (N already in pipeline)` for known matches

## LEAD-001 — Discover Company Decision Makers

| Criteria | Implementation |
|----------|----------------|
| Job titles | `searches.job_titles` → title filter (CEO, Founder, CTO, Marketing Director, VP Sales) |
| Company scope | Persisted `companies` for the search (`search_id`) |
| Pagination | `page` + `perPage` params; `hasMore` in response |
| Dedup | Email, LinkedIn URL, or name+company fallback |
| API | `POST /api/contacts/discover` with `searchId` |

**Providers:** `mock` (default) or `apollo` (`mixed_people/search` — paid plan required).

**Pipeline:** load companies → provider people search → title filter → dedup → persist contacts.

**Persistence:** `supabase/migrations/005_contacts.sql`

Run migrations `004_companies.sql` and `005_contacts.sql` before testing.

### Testing LEAD-001

1. Create a search with job titles: CEO, Founder, CTO, Marketing Director, VP Sales
2. Expand the search card → **Discover companies** (saves companies to DB)
3. Click **Discover decision-makers** — mock returns contacts per company domain
4. Re-run contact discovery → duplicates skipped for known contacts
5. If no companies exist, API returns `NO_COMPANIES` with guidance

```bash
curl -X POST http://localhost:3000/api/contacts/discover \
  -H "Content-Type: application/json" \
  -d '{"searchId":"<your-search-uuid>","page":1,"perPage":10}'
```

## LEAD-002 — Enrich Lead Profiles

| Field | Source |
|-------|--------|
| Name | `full_name` from contact + enrichment provider |
| Role | Job title (`title`) |
| Company | Company name from joined `companies` row |
| LinkedIn | `linkedin_url` — filled by enrichment if missing |
| Location | `city`, `state`, `country` formatted as location string |

**API:** `POST /api/leads/enrich` with `searchId`

**Providers:** `mock` (default) or `apollo` (`people/match` — paid plan required).

**Pipeline:** load contacts for search → enrich profiles → persist to `contacts` table.

**Persistence:** `supabase/migrations/006_contacts_enrichment.sql` adds enrichment columns.

Run migrations `004`–`006` before testing.

### Testing LEAD-002

1. Discover companies → discover decision-makers on a search
2. Click **Enrich lead profiles** — mock fills LinkedIn + location per contact
3. Visit **Leads** page to see all enriched profiles
4. Re-run enrichment to refresh profile data

```bash
curl -X POST http://localhost:3000/api/leads/enrich \
  -H "Content-Type: application/json" \
  -d '{"searchId":"<your-search-uuid>"}'
```

## LEAD-003 — Email Verification

| Step | Implementation |
|------|----------------|
| Syntax validation | RFC-style format check before any API call |
| Domain validation | MX/A record lookup (mock uses predictable rules) |
| Verification API | `mock` (default) or `hunter` (`/v2/email-verifier`) |

**API:** `POST /api/leads/verify-emails` with `searchId`

**Pipeline:** syntax check → domain check → provider API → persist status on `contacts`.

**Statuses:** `valid`, `invalid`, `invalid_syntax`, `invalid_domain`, `risky`, `unknown`, `no_email`

**Persistence:** `supabase/migrations/007_contacts_email_verification.sql`

Run migration `007` before testing.

### Testing LEAD-003

1. Discover companies → decision-makers → enrich profiles
2. Click **Verify emails** on a search card
3. Mock marks standard emails as **Verified**; use `invalid@...` or `risky@...` local parts to test failures
4. Visit **Leads** — verification badges appear next to emails

```bash
curl -X POST http://localhost:3000/api/leads/verify-emails \
  -H "Content-Type: application/json" \
  -d '{"searchId":"<your-search-uuid>"}'
```

## SEARCH-004 — Exclusion Rules

| Exclusion | Field | Validation |
|-----------|-------|------------|
| Domains | Tag input | Valid domain format, normalized |
| Industries | Tag input | Cannot match target industry |
| Keywords | Tag input | Optional |
| Countries | Tag input | Cannot match target country |

Run migration `supabase/migrations/003_search_exclusions.sql` in the Supabase SQL Editor.

## SEARCH-003 — Saved Searches

| Feature | Implementation |
|---------|----------------|
| Persist searches | Supabase `searches` table with RLS |
| List saved searches | Filterable panel with status tabs |
| Filter & sort | By status, name/industry/country, newest/oldest/name |
| Duplicate | Copy button creates draft clone |
| Status management | Draft / Active / Completed dropdown |
| Expand details | View full criteria on each card |

### Testing SEARCH-003

1. Create searches — they appear in Saved searches panel.
2. Filter by Draft / Active / Completed tabs.
3. Search by name in the filter box.
4. Click **Duplicate** — a copy appears as draft.
5. Expand a card — change status, view all criteria.
6. Delete a search — removed from list after refresh.

### Testing SEARCH-002

1. Create a search — fill all required fields, submit.
2. Click **Edit** on a saved search — form loads with existing values.
3. Change criteria and click **Save changes**.
4. Click **Cancel** during edit — form resets to create mode.
5. Submit empty form — see validation errors on required fields.

## AUTH-003 — Protected Routes

| Route | Page |
|-------|------|
| `/dashboard` | Overview & stats |
| `/searches` | Company search criteria |
| `/leads` | Lead pipeline |
| `/emails` | Outreach campaigns |
| `/analytics` | Performance insights |
| `/settings` | Account settings |

All routes require authentication. Unauthenticated access redirects to `/login` with the original path preserved.

### Testing AUTH-003

1. Sign out, then visit each protected URL — you should be redirected to login with a banner.
2. Sign in — sidebar navigation should work across all pages.
3. On mobile, open the hamburger menu and navigate between pages.

## AUTH-002 — Session Management

| Criteria | Implementation |
|----------|----------------|
| Session persists on refresh | Middleware calls `getUser()` to validate & refresh tokens; refreshed cookies returned on every request |
| Session expiration supported | Expired sessions detected in middleware + client `SessionProvider`; user redirected with `session_expired` banner |
| Invalid sessions rejected | Stale/invalid cookies cleared via `signOut()`; user redirected with `invalid_session` banner |

### Testing AUTH-002

1. **Persist on refresh** — Sign in, open `/dashboard`, hard-refresh (Cmd+Shift+R). You should stay logged in.
2. **Session expiration** — Sign in, clear only the access token cookie in DevTools (keep refresh token), refresh page. Middleware should refresh the session OR redirect with "session expired".
3. **Invalid session** — Sign in, corrupt the `sb-*-auth-token` cookie value in DevTools, visit `/dashboard`. You should be redirected to `/login` with "Your session is invalid."
4. **API check** — `GET /api/auth/session` returns `{ authenticated: true, expiresAt }` when logged in, `401` when not.

## Project Structure

```
src/
├── app/
│   ├── (protected)/    # Auth-required pages (dashboard, searches, leads, …)
│   ├── login/
│   └── auth/callback/
├── components/
│   ├── auth/
│   └── layout/         # AppShell, sidebar, page headers
├── lib/
│   ├── supabase/
│   └── auth/           # Routes, session, auth context
└── middleware.ts
```
