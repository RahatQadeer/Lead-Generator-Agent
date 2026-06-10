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
