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
| `/student/dashboard` | Protected (`student`, `admin`) | Student workspace: today's tasks, active study plans, quick metrics, doubt inquiries |
| `/student/tasks` | Protected (`student`, `admin`) | Today's prioritized study tasks organized by mentor |
| `/student/plans` | Protected (`student`, `admin`) | Study roadmaps broken down from university syllabus |
| `/student/assignments` | Protected (`student`, `admin`) | Problem sets and practice submissions |
| `/student/evaluations` | Protected (`student`, `admin`) | Mentor review sessions and evaluation feedback |
| `/student/progress` | Protected (`student`, `admin`) | Study metrics, completion tracking, and cycle overview |
| `/student/resources` | Protected (`student`, `admin`) | Curated study materials and reference links |
| `/student/doubts` | Protected (`student`, `admin`) | Conceptual questions and mentor responses |
| `/student/announcements` | Protected (`student`, `admin`) | Notices and schedule updates from mentor |
| `/student/notifications` | Protected (`student`, `admin`) | Real-time alerts for tasks, plans, feedback, and replies |
| `/student/subjects` | Protected (`student`, `admin`) | University courses and enrolled subjects |
| `/mentor/dashboard` | Protected (`mentor`, `admin`) | Mentor console: assigned students, attention queue, quick action cards |
| `/mentor/tasks` | Protected (`mentor`, `admin`) | Assign and monitor daily study tasks for students |
| `/mentor/plans` | Protected (`mentor`, `admin`) | Draft and manage syllabus study roadmaps |
| `/mentor/assignments` | Protected (`mentor`, `admin`) | Create and assign practice sets and homework |
| `/mentor/reviews` | Protected (`mentor`, `admin`) | Inspect and grade student submissions with qualitative feedback |
| `/mentor/evaluations` | Protected (`mentor`, `admin`) | Schedule review sessions and record evaluations |
| `/mentor/progress` | Protected (`mentor`, `admin`) | Overview of student performance and completion rates |
| `/mentor/resources` | Protected (`mentor`, `admin`) | Curate study materials for students |
| `/mentor/doubts` | Protected (`mentor`, `admin`) | Answer and clarify student doubt inquiries |
| `/mentor/announcements` | Protected (`mentor`, `admin`) | Dispatch notices to cohort or individual students |
| `/mentor/subjects` | Protected (`mentor`, `admin`) | Configure syllabus subjects for assigned students |
| `/admin/dashboard` | Protected (`admin`) | System admin control sector |
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
4. `20260927000004_role_protection_and_security.sql` (Role authorization hardening)
5. `20260927000005_provision_test_accounts.sql` (Initial test accounts)
6. `20261021000001_subjects_schema.sql` (University course subjects)
7. `20261021000002_study_plans_schema.sql` (Study plans and roadmaps)
8. `20261021000003_tasks_schema.sql` (Daily study tasks)
9. `20261021000004_assignments_schema.sql` (Assignments and problem sets)
10. `20261021000005_mentor_review_and_feedback_schema.sql` (Submissions and qualitative review)
11. `20261021000006_evaluations_schema.sql` (Evaluation check-ins and progress calibration)
12. `20261021000007_progress_tracking_indexes.sql` (Study cycle and progress tracking indexes)
13. `20261021000008_resources_schema.sql` (Curated study resources)
14. `20261021000009_doubts_schema.sql` (Academic doubt clarification threads)
15. `20261021000010_announcements_schema.sql` (Mentor and platform announcements)
16. `20261021000011_notifications_schema.sql` (In-app real-time notification feeds)

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

## Communication & Notification Architecture

### In-App Notification System (Current MVP)
- Real-time in-app notification center for all student and mentor events.
- Triggered automatically upon successful mentor actions:
  - New daily study task assigned.
  - New assignment or problem set published.
  - Qualitative submission review and feedback recorded.
  - Evaluation session scheduled or completed.
  - Mentor response posted to a student doubt inquiry.
  - Cohort or individual announcement dispatched.
- Enforces strict recipient isolation via Supabase Row Level Security (RLS) with offline mock fallback.

### WhatsApp Mentorship & Future Automated Notifications
- **Direct Mentorship Channel (Current MVP):** WhatsApp serves as an immediate, real-life communication channel between students and mentors for rapid check-ins, coordination, and urgent study queries. Direct chat links connect members to authorized mentors without claiming automatic delivery.
- **Automated Delivery (Planned Future Integration):** Automated notification dispatch to a student's verified WhatsApp phone number is designed as an optional future backend integration using the official Meta WhatsApp Business Cloud API. This will require:
  - A verified Meta Business Account and dedicated business phone number.
  - Meta-approved outbound message templates (for task alerts, assignment notices, and evaluation reminders).
  - Server-side execution (e.g. Supabase Edge Functions) to protect access tokens and API secrets outside client-side bundles.
  - User opt-in and phone-number verification.
  - In the current MVP, all notifications remain reliably delivered through the in-app notification desk.

---

## Core Application Modules

- **Personal Study Assistance:** Structured daily study plans and tasks organized by mentors from university syllabi.
- **Practice & Submissions:** Targeted problem sets and assignments with qualitative mentor review.
- **Evaluations & Check-ins:** Periodic reviews via Google Meet, Zoom, or written feedback to check understanding and calibrate pace.
- **Doubt Resolution:** Direct question-and-answer threads between students and assigned mentors.
- **Curated Resources:** Mentor-curated lecture notes, reference sheets, and textbook excerpts.
- **Progress Tracking:** Real-time visibility into completed tasks, submitted assignments, and evaluations.
