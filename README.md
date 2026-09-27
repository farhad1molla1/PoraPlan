# PoraPlan — Personal Study Assistance & Mentorship Platform

> **Tagline:** You study. We organize how, what and when.  
> **Product Purpose:** A structured academic planning, study habit tracking, and student-mentor collaboration platform built with a Neo-Brutalist Retro-Academic interface.

---

## Current Architecture

PoraPlan is built as a single-page application (SPA) with a public marketing presence and a role-guarded authenticated application shell. Backend services, authentication, and relational data persistence are powered by Supabase (PostgreSQL) with strict Row Level Security (RLS).

```
Client (React 19 + TypeScript + Vite)
  ├── Public Website Shell (RootLayout)
  │     └── Landing, How It Works, About, Login, Signup
  └── Authenticated Workspace Shell (DashboardLayout)
        ├── /student/dashboard (Student Sector)
        ├── /mentor/dashboard  (Mentor Sector)
        └── /admin/dashboard   (Admin Sector)
                  │
                  ▼
         Supabase Backend (PostgreSQL)
  ├── Supabase Auth (Email/Password, Session Persistence)
  ├── profiles Table (Linked to auth.users, user_role enum)
  ├── mentor_students Table (Pairings with no-self-mentoring check)
  └── Strict RLS Policies (Isolated cross-tenant data access)
```

---

## Current Tech Stack

- **Frontend Core:** React 19, TypeScript ~6.0, Vite 6 (configured with wasm-node for cross-platform portability)
- **Styling & Design System:** Tailwind CSS v3 (Neo-Brutalist retro-academic theme, `#082B4C`, `#0BA7B4`, `#F5A623`, `#F6FAFB`, `#172B3A`)
- **Routing:** React Router v7 with role-aware protected route guards
- **Backend & Database:** Supabase (`@supabase/supabase-js` v2)
- **Database Migrations:** Supabase CLI / PostgreSQL SQL migrations in `supabase/migrations/`
- **Icons:** Lucide React
- **Code Quality:** Oxlint

---

## Current Development Phase

**Phase 1 — Authenticated Application & Dashboard Foundation**

All Phase 0 visual foundations and Phase 1 authentication/database foundations are implemented and synchronized. The project provides working authentication, database role triggers, strict RLS security, and dedicated authenticated shells for students and mentors.

---

## Supabase, Auth, Roles & Security

### 1. Supabase Client
- Instantiated in `src/lib/supabase.ts` using Vite client environment variables.
- Utilizes the publishable anonymous key only (`VITE_SUPABASE_ANON_KEY`). Service role keys are never included in the frontend.
- Provides fallback diagnostics (`isSupabaseConfigured()`, `testSupabaseConnection()`).

### 2. Authentication & Session Persistence
- Email and password authentication via `supabase.auth.signInWithPassword()` and `supabase.auth.signUp()`.
- Google OAuth authentication via `supabase.auth.signInWithOAuth({ provider: 'google' })`.
- Password reset flow via `supabase.auth.resetPasswordForEmail()`.
- Client-side session persistence via Supabase Auth session listeners (`onAuthStateChange`).
- Centralized auth state and profile hydration managed through `AuthContext` and `useAuth` hook.

> **Google OAuth Configuration (One-Time Setup in Supabase Dashboard):**
> 1. In Google Cloud Console, create OAuth 2.0 Client ID (Web Application).
> 2. Add Authorized Redirect URI: `https://<your-supabase-project-id>.supabase.co/auth/v1/callback`.
> 3. In your Supabase Dashboard, navigate to **Authentication → Providers → Google**, enable the toggle, and paste your Google **Client ID** and **Client Secret**.
> 4. Add your application URL (e.g. `http://localhost:5173/**`) to **Authentication → URL Configuration → Redirect URLs**.

### 3. Roles
- Supported user roles: `student`, `mentor`, `admin` (defined as `user_role` enum in PostgreSQL).
- Signup automatically injects the selected role into user metadata.
- A database trigger (`handle_new_user`) automatically provisions a record in `public.profiles` upon signup.

### 4. Row Level Security (RLS) & Policies
- **`public.profiles`**:
  - Users can read and update their own profile (`auth.uid() = id`).
  - Mentors can view profiles of assigned students only.
  - Students can view profiles of assigned mentors only.
  - Admins can view all profiles.
- **`public.mentor_students`**:
  - Mentors can view records where they are the assigned mentor (`auth.uid() = mentor_id`).
  - Students can view records where they are the assigned student (`auth.uid() = student_id`).
  - Check constraint prevents self-mentoring (`mentor_id != student_id`).
  - Admins have full management access.
  - Zero open `USING (true)` bypass policies.

---

## Current Routes

| Route | Access | Description |
|---|---|---|
| `/` | Public | Hero, 7-step Core Workflow, and platform introduction |
| `/how-it-works` | Public | Step-by-step learning engine specification |
| `/about` | Public | Educational philosophy and system dossier |
| `/login` | Public (Unauthenticated) | Neo-brutalist authentication portal with role-aware redirect |
| `/signup` | Public (Unauthenticated) | Registration with role selection (Student / Mentor) |
| `/student/dashboard` | Protected (`student`, `admin`) | Student workspace: greeting, focus, tasks, progress placeholders, quick links |
| `/mentor/dashboard` | Protected (`mentor`, `admin`) | Mentor workspace: student count, review queue, evaluations, student roster |
| `/admin/dashboard` | Protected (`admin`) | System admin control sector placeholder |
| `/dashboard` | Protected | Dynamic resolver redirecting to role workspace |

---

## Local Setup & Environment Variables

### 1. Clone & Install
```bash
git clone https://github.com/farhad1molla1/PoraPlan.git
cd PoraPlan
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Update `.env.local` with your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```
> **Security Note:** Never commit `.env.local` or service role keys. The `.gitignore` excludes all `.env*` files except `.env.example`.

### 3. Run Database Migrations
Apply SQL files located in `supabase/migrations/` to your Supabase PostgreSQL instance:
1. `20260927000001_profiles_schema.sql` (Profiles table, roles enum, triggers)
2. `20260927000002_mentor_students_rls.sql` (Mentor-student pairings and RLS)

### 4. Development & Build Commands
```bash
# Start development server
npm run dev

# Run production build and TypeScript check
npm run build

# Run linter
npm run lint
```

---

## Current Completed Milestones

- [x] **Phase 0:** Neo-Brutalist design system, responsive landing page, how-it-works, about, public layouts.
- [x] **Phase 1A:** Supabase client connection & environment configuration.
- [x] **Phase 1B:** Profiles schema & role foundation with database triggers.
- [x] **Phase 1C:** Mentor-student relationship schema & strict RLS policies.
- [x] **Phase 1D:** Authentication engine (signup, login, logout, session persistence, role routing).
- [x] **Phase 1E:** Authenticated student & mentor dashboard foundation shell with mobile-first navigation.

---

## Next Milestone

- **Phase 2 (Milestone 1):** Academic Subjects & Daily Study Planning Engine (Subjects schema, daily routine scheduler, and study target models).
