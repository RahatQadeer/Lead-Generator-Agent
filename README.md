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

## Project Structure

```
src/
├── app/
│   ├── login/          # Login page
│   ├── dashboard/      # Protected dashboard
│   └── auth/callback/  # OAuth callback handler
├── components/
│   ├── auth/           # Login, logout, error UI
│   └── layout/         # Dashboard shell
├── lib/
│   ├── supabase/       # Browser, server, middleware clients
│   └── auth/           # Profile helpers
└── middleware.ts       # Route protection
```
