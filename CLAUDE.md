@AGENTS.md

# Asset Tracker — Project Guide

## Overview

A personal net-worth / asset tracking application built with **Next.js 16** (App Router), **Prisma 7** (PostgreSQL), **Tailwind CSS 4**, and **shadcn/ui v4** (base-nova style). It tracks accounts, holdings, exchange rates, price caches, and net-worth snapshots.

## Tech Stack

| Layer        | Technology                                       |
| ------------ | ------------------------------------------------ |
| Framework    | Next.js 16.2 (App Router, React 19, RSC)         |
| Language     | TypeScript 5, strict mode                        |
| Database     | PostgreSQL via Prisma 7 (`@prisma/client`)       |
| Styling      | Tailwind CSS 4 + shadcn/ui v4 (base-nova style)  |
| UI Icons     | Lucide React                                     |
| Charts       | Recharts 3                                       |
| Data Fetching| Yahoo Finance 2 (for market prices)              |
| Validation   | Zod 4                                            |
| Fonts        | Geist Sans / Geist Mono via `next/font/google`   |

## Project Structure

```
src/
├── app/              # Next.js App Router pages & layouts
│   ├── layout.tsx     # Root layout (Geist fonts, global CSS)
│   ├── page.tsx       # Home page
│   └── globals.css    # Global styles & Tailwind config
├── components/
│   └── ui/            # shadcn/ui components (e.g. button.tsx)
├── generated/
│   └── prisma/        # Auto-generated Prisma client (gitignored)
└── lib/
    ├── prisma.ts      # Prisma client singleton
    ├── types.ts       # Shared TypeScript types
    ├── utils.ts       # Utility helpers (cn, etc.)
    ├── validators.ts  # Zod schemas
    └── currencies.ts  # Currency definitions
prisma/
└── schema.prisma      # Database schema
```

## Key Conventions

### Code Style
- Use TypeScript with strict mode for all new code.
- Use `@/*` path alias for imports from `src/` (e.g. `@/lib/utils`).
- Prefer React Server Components (RSC) by default; add `"use client"` only when client interactivity is needed.
- Use `Decimal` (from Prisma) for all monetary/quantity values — never `number`.

### Styling
- Use **Tailwind CSS 4** utility classes — do NOT use inline styles or CSS Modules.
- Use **shadcn/ui** components from `@/components/ui/` when available; add new ones via `npx shadcn@latest add <component>`.
- CSS variables for theming are defined in `globals.css`.

### Database
- Prisma schema lives at `prisma/schema.prisma`.
- Generated client output is `src/generated/prisma/` (gitignored).
- After changing the schema, run: `npx prisma generate` then `npx prisma db push` (dev) or `npx prisma migrate dev` (production-track).
- Access the database client via `@/lib/prisma` singleton.

### Validation
- Use **Zod 4** schemas from `@/lib/validators.ts` for input validation.

### Next.js Specifics
- This project uses **Next.js 16** which may have breaking changes from earlier versions. Always check `node_modules/next/dist/docs/` for up-to-date API documentation before writing code.
- App Router only — no `pages/` directory.
- Use `next/font/google` for fonts (already configured with Geist).

## Commands

```bash
# Development
npm run dev          # Start dev server (http://localhost:3000)

# Build & Production
npm run build        # Production build
npm run start        # Start production server

# Linting
npm run lint         # Run ESLint

# Database
npx prisma generate  # Regenerate Prisma client
npx prisma db push   # Push schema to database (dev)
npx prisma studio    # Open Prisma Studio GUI
```
