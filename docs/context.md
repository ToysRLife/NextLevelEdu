# Project Context

## Project Name

NextLevelEdu

## What It Is

A simple, maintainable educational gaming platform for early learners.

## Target Audience

- Students in grades 1–3 for the initial phase
- Parents and teachers as supportive stakeholders

## Core Goals

- Make learning fun through games
- Keep development easy for a solo team
- Build from a clean, reproducible boilerplate

## Key Requirements

- Scaffold from `npx create-next-app@latest`
- Use `pnpm` instead of `npm`
- Keep the architecture simple and maintainable
- Use `shadcn/ui` for reusable UI patterns
- Avoid vendor lock-in
- Use `.env` for configuration
- Avoid Vercel-specific APIs

## Tech Stack

- Next.js App Router
- JavaScript
- Tailwind CSS
- shadcn/ui
- PostgreSQL
- Prisma
- Auth.js

## Implementation Libraries

- ESLint
- Prettier
- Husky
- lint-staged
- GitHub Actions

## Architecture Principles

- Feature-based modules
- Reusable components
- Server Components when appropriate
- Strong type safety
- Mobile-first design
- Accessibility support
- Minimal technical debt

## Initial Scope

- Class 4 mathematics MVP
- Game-based learning experiences
- Progress tracking
- Simple reward mechanics

## Folder Structure

- `app/`
- `components/`
- `features/`
- `lib/`
- `hooks/`
- `types/`
- `prisma/`
- `public/`

## Quality Standards

- Clean, maintainable JavaScript
- Avoid unsafe `any`-like patterns
- Reusable hooks and services
- Validation and error handling
- Simple, readable code
