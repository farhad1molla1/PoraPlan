# PoraPlan MVP (Phase 0: Project Foundation)

> **Tagline:** You study. We organize how, what and when.  
> **Product Context:** Personal Study Assistance & Mentorship platform.

---

## Overview

PoraPlan is a mobile-first Web App + PWA with a public landing website and private Student/Mentor dashboards.

This repository contains **Phase 0 Project Foundation**, providing a clean, scalable frontend architecture without backend dependencies.

### Core Workflow Engine
```
Plan → Study → Practice → Submit → Review → Feedback → Progress
```

---

## Design System: Neo-Brutalist Retro Academic

- **Deep Navy:** `#082B4C`
- **Teal:** `#0BA7B4`
- **Warm Gold:** `#F5A623`
- **Off White:** `#F6FAFB`
- **Dark Text:** `#172B3A`

### Key Design Elements
- High contrast, 2px-3px solid dark borders (`border-brand-dark`)
- Hard offset shadows (`shadow-brutal`, `shadow-brutal-lg`)
- Tactile interactive buttons with active depression offsets
- Academic index cards, docket stamps, syllabus indicators, and subtle graph-paper pattern (`academic-grid-pattern`)
- Mobile-first responsiveness prioritizing 360px, 390px, 430px viewports without horizontal overflow

---

## Tech Stack

- **Framework:** React 19 + TypeScript
- **Bundler:** Vite 6 (configured with wasm-node for seamless cross-platform support)
- **Styling:** Tailwind CSS v3
- **Routing:** React Router v7
- **Icons:** Lucide React

---

## Public Routes

| Route | Description |
|---|---|
| `/` | Landing page (Hero, PoraPlan principle, 7-step Core Workflow, CTA, Footer) |
| `/how-it-works` | Full workflow specification and Student vs. Mentor role architecture |
| `/about` | Educational philosophy, mission, and system specification dossier |
| `/login` | Accessible portal sign-in preview (Phase 0 preview, no backend) |
| `/signup` | Accessible student/mentor enrollment preview (Phase 0 preview, no backend) |

---

## Project Structure

```
d:/PoraPlan V0.1/
├── public/
│   └── favicon.svg           # Custom Neo-Brutalist academic favicon
├── src/
│   ├── assets/               # Static assets
│   ├── components/
│   │   ├── common/
│   │   │   ├── Badge.tsx     # Retro-academic status stamps & tags
│   │   │   ├── Button.tsx    # Tactile Neo-Brutalist button / link component
│   │   │   ├── Card.tsx      # Strong-border cards with hard-edge shadows
│   │   │   └── SectionHeading.tsx # Semantic headings with academic eyebrows
│   │   └── layout/
│   │       ├── Navbar.tsx    # Responsive header with mobile drawer menu
│   │       └── Footer.tsx    # Deep Navy semantic footer with metadata
│   ├── layouts/
│   │   └── RootLayout.tsx    # App shell containing Navbar, Outlet, Footer
│   ├── lib/
│   │   ├── constants.ts      # App config, canonical workflow steps, nav links
│   │   └── utils.ts          # Class helper utilities
│   ├── pages/
│   │   ├── LandingPage.tsx   # Landing page with study docket & 7 workflow steps
│   │   ├── HowItWorksPage.tsx# Step-by-step learning engine specification
│   │   ├── AboutPage.tsx     # Philosophy, mission, and platform specifications
│   │   ├── LoginPage.tsx     # Accessible sign-in form (Phase 0 preview)
│   │   ├── SignupPage.tsx    # Accessible enrollment form (Phase 0 preview)
│   │   └── NotFoundPage.tsx  # Custom 404 syllabus handler
│   ├── routes/
│   │   └── index.tsx         # Route definitions for all 5 public endpoints
│   ├── styles/
│   │   └── index.css         # Tailwind base & retro-academic background utilities
│   ├── types/
│   │   └── index.ts          # TypeScript interfaces and prop types
│   ├── App.tsx               # BrowserRouter wrapper
│   └── main.tsx              # React DOM entry point
├── package.json
├── tailwind.config.js        # Brand color tokens and hard-offset shadows
├── tsconfig.json
└── vite.config.ts
```

---

## Getting Started

### Install Dependencies
```bash
npm install
```

### Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Run Production Build & Type Check
```bash
npm run build
```

### Run Linter
```bash
npm run lint
```
