# PoraPlan — Personal Study Assistance & Mentorship Platform

> **Tagline:** You study. We organize how, what and when.  
> **Product Purpose:** A structured academic planning, study habit tracking, and student-mentor collaboration platform built with a Neo-Brutalist Retro-Academic interface.

---

## Official Contact Information

- **Email:** [poraplan.bd@gmail.com](mailto:poraplan.bd@gmail.com)
- **Facebook:** [PoraPlan Facebook Page](https://www.facebook.com/profile.php?id=61593180002346)
- **WhatsApp:** `@PoraPlan`

---

## Current Architecture

PoraPlan is built as a single-page application (SPA) with a public marketing presence and a role-guarded authenticated application shell. Backend services, authentication, and relational data persistence are powered by Supabase (PostgreSQL) with strict Row Level Security (RLS).

```
Client (React 19 + TypeScript + Vite)
  ├── Public Website Shell (RootLayout)
  │     └── Landing, How It Works, About, Login, Signup (Info), Reset Password
  └── Authenticated Workspace Shell (DashboardLayout)
        ├── /student/dashboard (Student Sector)
        ├── /mentor/dashboard  (Mentor Sector)
        └── /admin/dashboard   (Admin Sector)
                  │
                  ▼
         Supabase Backend (PostgreSQL)
  ├── Supabase Auth (PoraPlan ID + Password, Linked Google OAuth, Session Persistence)
  ├── profiles Table (Controlled poraplan_id, user_role enum, status, linked_email)
  ├── mentor_students Table (Pairings with no-self-mentoring check)
  └── Strict RLS Policies (Isolated cross-tenant data access)
```

---

## Controlled Account Model & Authentication

PoraPlan does **NOT** use open public self-registration. Every legitimate student, mentor, and administrator is issued a unique PoraPlan ID.

### 1. PoraPlan ID System
- **Students:** `PP001`, `PP002`, `PP003`, etc.
- **Mentors:** `PPM001`, `PPM002`, `PPM003`, etc.
- **Admins:** `PPA001`, `PPA002`, etc.

Accounts are pre-registered by authorized Mentors or Administrators with an initial status of `not_activated`.

### 2. Student & Mentor Account Flow
1. **Account Creation:** Admin/Mentor pre-registers the account with a unique PoraPlan ID and temporary password.
2. **First Activation:** Student/Mentor logs in with their PoraPlan ID and temporary password. Upon successful login, the account status advances to `active`.
3. **Email Association:** The member connects their personal email (e.g. `student@gmail.com`), linking it to their PoraPlan ID.

### 3. Login Options
- **Method 1: PoraPlan ID + Password (Primary)**
  - Enter PoraPlan ID (e.g. `PP001`) and password.
  - The system resolves the ID and authenticates securely against Supabase Auth.
- **Method 2: Continue with Google (Linked Accounts Only)**
  - Google login is **not** a registration method.
  - Only accounts whose Google email has already been associated with a pre-registered PoraPlan account are granted access.
  - Arbitrary unlinked Google accounts are immediately signed out and shown a friendly student guidance notice.

### 4. Password Recovery
- A member who forgets their password enters their verified email address associated with their PoraPlan account.
- Supabase sends a secure reset email pointing to `/reset-password`.
- User establishes a new password, preserving their PoraPlan ID and account history.
- Passwords cannot be reset with only a PoraPlan ID (access to the linked email is required).

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

## Supabase, Auth, Roles & Security

### 1. Supabase Client
- Instantiated in `src/lib/supabase.ts` using Vite client environment variables.
- Utilizes the publishable anonymous key only (`VITE_SUPABASE_ANON_KEY`). Service role keys are never exposed in the frontend.
- Provides fallback diagnostics (`isSupabaseConfigured()`, `testSupabaseConnection()`).

### 2. Roles & Account Status
- **User Roles:** `student`, `mentor`, `admin` (defined as `user_role` enum).
- **Account Statuses:** `not_activated`, `active`, `suspended`.
- Role escalation from the frontend is strictly prohibited and enforced via database RLS.

### 3. Row Level Security (RLS) & Policies
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

> **Google OAuth Configuration (One-Time Setup in Supabase Dashboard):**
> 1. In Google Cloud Console, create an OAuth 2.0 Client ID (Web Application).
> 2. Add Authorized Redirect URI: `https://<your-supabase-project-id>.supabase.co/auth/v1/callback`.
> 3. In Supabase Dashboard, navigate to **Authentication → Providers → Google**, enable the toggle, and paste your Google **Client ID** and **Client Secret**.
> 4. Add your application URL (e.g. `http://localhost:5173/**`) to **Authentication → URL Configuration → Redirect URLs**.

---

## Current Routes

| Route | Access | Description |
|---|---|---|
| `/` | Public | Hero, 5-Step Study Routine, and platform overview |
| `/how-it-works` | Public | The 7-step study cycle and mentor collaboration model |
| `/about` | Public | Educational philosophy, 9 student value points, and mentor support |
| `/login` | Public (Unauthenticated) | PoraPlan ID + Password login, Google login for linked members, and forgot password |
| `/signup` | Public (Unauthenticated) | Information notice on mentor-assigned PoraPlan IDs and support contact |
| `/reset-password` | Public | Secure password update interface for recovery sessions |
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
Apply SQL files located in `supabase/migrations/` to your Supabase PostgreSQL instance in sequential order:
1. `20260927000001_profiles_schema.sql` (Profiles table, roles enum, triggers)
2. `20260927000002_mentor_students_rls.sql` (Mentor-student pairings and strict RLS)
3. `20260927000003_controlled_poraplan_accounts.sql` (PoraPlan ID, account status, linkage verifiers)

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

## Completed Milestones

- [x] **Phase 0:** Neo-Brutalist design system, responsive landing page, how-it-works, about, public layouts.
- [x] **Phase 1A:** Supabase client connection & environment configuration.
- [x] **Phase 1B:** Profiles schema & role foundation with database triggers.
- [x] **Phase 1C:** Mentor-student relationship schema & strict RLS policies.
- [x] **Phase 1D:** Authentication engine & role routing.
- [x] **Phase 1E:** Authenticated student & mentor dashboard foundation shell with mobile-first navigation.
- [x] **Phase 1F:** Controlled PoraPlan account model (PoraPlan IDs, Google login for existing members, secure password recovery, contact info, removal of public self-signup).
