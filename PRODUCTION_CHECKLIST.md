# Lead Generator Agent — Production Checklist (Free Stack)

## Architecture

| Layer | Technology | Cost |
|-------|------------|------|
| Frontend | Next.js 16 + React 19 | Free |
| Backend | Next.js API Routes | Free |
| Database | Supabase Free Tier | Free |
| Auth | Google OAuth via Supabase | Free |
| Company/Contact Data | SearXNG + Wikipedia/Wikidata + Cheerio + Playwright fallback | Free |
| Email Verification | DNS MX lookup | Free |
| Email Generation | Template mock or OpenRouter free models | Free |
| Email Send/Reply | Gmail OAuth API | Free |
| Deployment | Docker + any Node host | Free tier options |

## Environment (copy `.env.example` → `.env.local`)

```env
COMPANY_DATA_PROVIDER=scraping
EMAIL_VERIFICATION_PROVIDER=dns
EMAIL_GENERATION_PROVIDER=mock
EMAIL_SENDING_PROVIDER=gmail
REPLY_TRACKING_PROVIDER=gmail
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

## Database Setup

1. Create Supabase project
2. Run all 24 migrations in `supabase/migrations/` in order
3. Enable Google OAuth provider
4. Add redirect URL: `http://localhost:3000/auth/callback`

## Feature Checklist

### Lead pipeline
- [x] Search criteria builder
- [x] Company discovery (scraping provider)
- [x] Contact discovery (website team page scraping)
- [x] Lead enrichment (website metadata)
- [x] Email verification (DNS)
- [x] Lead scoring (local rules)
- [x] Email generation (templates + optional OpenRouter)
- [x] Gmail send + reply tracking
- [x] Campaign batch send
- [x] Follow-up scheduling
- [x] Dashboard analytics

### Engineering
- [x] Provider factory pattern (swap mock/scraping/paid)
- [x] Rate limiting on scraper
- [x] robots.txt compliance
- [x] Structured JSON logging
- [x] Environment validation (`src/lib/env.ts`)
- [x] Health check (`GET /api/health`)
- [x] Docker + docker-compose
- [x] Vitest unit tests

### Remaining optional enhancements
- [x] CSV lead import UI + API
- [x] UK Companies House API provider
- [x] Dark mode toggle
- [x] BullMQ + Redis job queue (async company discovery)
- [x] GitHub Actions CI
- [x] Playwright fallback for JS-rendered sites
- [ ] E2E Playwright tests

## CSV import

1. Open a saved search → expand **Outreach steps**
2. Click **Template** to download sample CSV
3. Upload your CSV with columns: `company,domain,industry,country,city,contact_name,title,email,linkedin`
4. Companies + contacts are saved immediately (provider: `csv`)

## UK Companies House (free official data)

```env
COMPANY_DATA_PROVIDER=companies-house
COMPANIES_HOUSE_API_KEY=your_key
```

Create search with **Country = United Kingdom**, then run **Find companies**.

## Async scraping (BullMQ)

```env
REDIS_URL=redis://localhost:6379
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

```bash
npm run worker          # start background worker
docker compose up -d    # app + redis + worker
```

Discover with async mode:
```json
POST /api/companies/discover
{ "searchId": "...", "async": true }
```

Poll job status: `GET /api/jobs/{jobId}`

## Dark mode

Use the moon/sun toggle in the top header bar. Preference is saved in localStorage.

## Commands

```bash
npm install
npm run dev          # Local development
npm run build        # Production build
npm run test         # Unit tests
npm run test:watch   # Watch mode
docker compose up    # Containerized deploy
curl localhost:3000/api/health
```

## Scraping stack (free)

| Step | Tools |
|------|-------|
| Company discovery | SearXNG → Wikipedia/Wikidata → DuckDuckGo (web only) |
| Contact pages | Cheerio on `/about`, `/team`, `/leadership`, `/our-team`, `/management`, `/staff` |
| JS sites | Playwright headless Chromium when Cheerio finds no data |
| Email/phone | Regex extraction + DNS/MX verification |
| Ethics | robots.txt + per-host rate limiting |

```bash
npx playwright install chromium   # one-time setup for Playwright fallback
```

## Scraping ethics

- Respects `robots.txt`
- Rate-limited (1 req/sec per host)
- Only public business pages
- No LinkedIn/social scraping
- User-Agent identifies bot

## Demo flow

1. **Searches** → Create search (e.g. Technology, Pakistan, CEO)
2. **Find companies** → Scraping discovers real domains from web search
3. **Find contacts** → Scrapes /team, /about pages
4. **Enrich + Verify + Score** → Pipeline steps
5. **Leads** → Generate email draft
6. **Emails** → Send via Gmail, check replies

## Deployment

1. Set all env vars on host
2. `docker compose up -d --build`
3. Verify `GET /api/health` returns `"status": "ok"`
4. Connect Gmail in Settings before sending
