# VGG Integrated System — Setup Guide

## What you have

Two separate Next.js projects that share ONE Supabase database:

### 1. `vgg-admin-website.zip` — Admin Dashboard + Public Website
- `/` — Public marketing website (hero, projects, gallery, amenities, etc.)
- Floating admin button (bottom-right) → PIN-gated Content Manager overlay
- Sidebar with 5 groups, 19 sections:
  - **Homepage**: Hero Banners, Company Stats, Timeline Events
  - **Content**: Gallery, Amenities, Videos, Offers, News
  - **Social Proof**: Testimonials, Team Members
  - **Info**: FAQs, Nearby Places, Brochures
  - **Field Agents**: Agent Profiles, Attendance, Branding, Posts, Brochures, Videos
- Mobile-friendly: sidebar becomes a drawer on small screens
- Search bar to filter sidebar sections

### 2. `vgg-agent-pwa.zip` — Field Agent PWA
- `/agent` — Phone + password login, photo check-in/out with geofence, content hub, profile
- Reads branding (app name, logo) from `agent_settings` (edited in the admin dashboard)
- Reads content (posts, brochures, videos) from `agent_content_*` tables (edited in the admin dashboard)
- Submits attendance to `agent_attendance` table (viewable in admin dashboard)

## How they connect

Both projects point to the **same Supabase project** via the same env vars:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY
```

| Action in Admin Dashboard | Effect in Agent PWA |
|---|---|
| Edit "Agent App Branding" → change app_name/logo | Splash + sign-in screen update instantly |
| Add an "Agent Profile" | New agent can sign in (after you set their password in Supabase Auth) |
| Add an "Agent Post" | Appears in the agent's content hub |
| Add an "Agent Brochure" | Appears in the agent's brochures tab |
| Add an "Agent Video" | Appears in the agent's videos tab |
| View "Agent Attendance" | See all check-ins/outs with photos + geolocation |
| Toggle "Geofence Enabled" + set office lat/lng/radius | Agents get warned when checking in outside the radius |

---

## Setup steps

### Step 1 — Create the Supabase project (once)

1. Go to https://supabase.com → New Project
2. Note your Project URL, anon key, and service_role key (Project Settings → API)

### Step 2 — Run the shared schema migration (once)

1. Open Supabase SQL Editor
2. Open the file `supabase/shared-schema.sql` (same file in both zips)
3. Paste the contents and Run

This creates all 19 tables (13 website + 6 agent), RLS policies, storage buckets, and triggers.

### Step 3 — Create your first agent user (once)

Run this SQL in the Supabase SQL editor (replace phone/password if you want different credentials):

```sql
create extension if not exists pgcrypto;

-- Delete any existing demo agent
with old as (
  select auth_user_id from public.agent_profiles
   where phone = '+919876543210' or email = 'agent@vgg-attendance.local'
)
delete from auth.users where id in (select auth_user_id from old where auth_user_id is not null);
delete from public.agent_profiles
 where phone = '+919876543210' or email = 'agent@vgg-attendance.local';

-- Create the auth user (Supabase Auth needs an email + bcrypt password)
insert into auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, aud, role,
  created_at, updated_at, confirmation_token, recovery_token, last_sign_in_at
) values (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'agent@vgg-attendance.local',
  crypt('agent123', gen_salt('bf', 10)),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Demo Agent"}'::jsonb,
  'authenticated', 'authenticated',
  now(), now(), '', '', null
);

-- Link the agent_profiles row
insert into public.agent_profiles (
  auth_user_id, full_name, email, phone, employee_code,
  designation, department, reporting_manager, joined_at, active
)
select
  au.id, 'Demo Agent', 'agent@vgg-attendance.local',
  '+919876543210', 'VGG-001', 'Field Executive', 'Operations',
  'Administrator', now(), true
from auth.users au
where au.email = 'agent@vgg-attendance.local';
```

### Step 4 — Set up the Admin + Website project

```bash
unzip vgg-admin-website.zip -d vgg-admin-website
cd vgg-admin-website
npm install
cp .env.example .env.local
# Edit .env.local with your Supabase URL, anon key, service role key
npm run dev
```

Visit `http://localhost:3000` → click the floating gear button (bottom-right) → enter PIN `1234`.

### Step 5 — Set up the Agent PWA project

```bash
unzip vgg-agent-pwa.zip -d vgg-agent-pwa
cd vgg-agent-pwa
npm install
cp .env.example .env.local
# Edit .env.local with the SAME Supabase URL, anon key, service role key
npm run dev
```

If both projects run on the same machine, run them on different ports:
```bash
# In vgg-admin-website:
PORT=3000 npm run dev
# In vgg-agent-pwa:
PORT=3001 npm run dev
```

Visit `http://localhost:3001/agent` → log in with phone `+919876543210` and password `agent123`.

### Step 6 — Test the integration

1. In the admin dashboard (port 3000), open the **Field Agents** sidebar group → **Agent App Branding**
2. Change the app name to "My Field App" and save
3. Refresh the agent PWA (port 3001) sign-in page → the new name appears

---

## Project structure

### Admin + Website (`vgg-admin-website.zip`)

```
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout (fonts, theme provider)
│   │   ├── page.tsx            # Public website home page
│   │   ├── globals.css         # Premium farmland theme (cream + forest + gold)
│   │   └── api/
│   │       ├── route.ts        # Health check
│   │       └── status/route.ts # Supabase configured?
│   ├── components/
│   │   ├── admin/
│   │   │   ├── admin-button.tsx        # Floating gear button
│   │   │   ├── content-manager.tsx     # Modern responsive admin shell
│   │   │   ├── crud.ts                 # Supabase CRUD helpers (with localStorage fallback)
│   │   │   └── shared/
│   │   │       ├── editor-configs.tsx  # 19 section configs (13 website + 6 agent)
│   │   │       ├── editor-shell.tsx    # Table view + form modal + reorder
│   │   │       ├── field-renderer.tsx  # Renders fields by type
│   │   │       └── field-types.ts      # Type definitions
│   │   ├── sections/           # 13 website sections (hero, about, gallery, etc.)
│   │   ├── site/               # Navbar, footer, demo banner
│   │   └── ui/                 # shadcn/ui components (60+)
│   ├── hooks/                  # use-mobile, use-toast, use-vgg-data
│   └── lib/                    # data, demo-data, supabase-client, types, utils
├── supabase/
│   └── shared-schema.sql       # ← RUN THIS FIRST
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── next.config.ts
```

### Agent PWA (`vgg-agent-pwa.zip`)

```
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout (agent theme)
│   │   ├── page.tsx            # Redirects to /agent
│   │   ├── agent/              # Agent PWA pages (splash, sign-in, home, profile, etc.)
│   │   └── api/agent/          # Agent API routes (login, attendance, profile, branding, content)
│   ├── components/agent/       # Agent UI components (splash, sign-in, top-bar, attendance card, etc.)
│   ├── hooks/agent/            # use-agent-auth
│   └── lib/agent/              # supabase client, server-supabase, types
├── supabase/
│   ├── shared-schema.sql       # Same file as admin (for reference)
│   └── agent-migration.sql     # Same as shared-schema.sql (backwards compat)
├── public/                     # PWA manifest + icons
├── package.json
└── next.config.ts
```

---

## Default credentials

| Route | Handle | Password |
|---|---|---|
| Admin overlay (website `/`) | PIN: `1234` | — |
| Agent PWA (`/agent`) | Phone: `+919876543210` | `agent123` |

**Change these in production:**
- Admin PIN: edit `src/components/admin/content-manager.tsx` line `const ADMIN_PIN = "1234"` — replace with NextAuth / Supabase Auth
- Agent password: change via Supabase Auth dashboard, or via the admin UI's "Agent Profiles" editor

---

## Security notes

- The website content tables (hero_banners, gallery_images, etc.) do NOT have RLS enabled. This matches the existing behavior — anyone with the anon key can read/write. For production, enable RLS and add policies.
- The agent_* tables DO have RLS enabled:
  - Agents can only read/update their own profile
  - Agents can only read their own attendance rows
  - Agents can only insert attendance rows linked to their own profile
  - Agents can read published content (posts/brochures/videos) but not write
  - Agents CANNOT read `agent_settings` (geofence config is hidden) — branding is exposed via the `get_agent_branding()` function
- The admin dashboard's PIN gate is a thin client-side check. For production, replace it with proper server-side auth (NextAuth, Supabase Auth, or your existing admin dashboard's auth).

---

## Tech stack

Both projects share:
- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS 4
- shadcn/ui
- Supabase (Postgres + Auth + Storage)
- Framer Motion (animations)
- Sonner (toasts)

Admin + Website also uses:
- 60+ shadcn/ui components
- Lucide icons
- React Hook Form + Zod
- Recharts (charts)
- Embla Carousel
- React Syntax Highlighter

Agent PWA also uses:
- TanStack Query (data fetching)
- Zustand (state)
- PWA manifest + icons
