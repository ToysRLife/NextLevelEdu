# Architecture Design

## Objective

Define a simple, maintainable architecture for NextLevelEdu that supports a lean development flow and future growth.

## Scaffold Approach

- Use `npx create-next-app@latest` to bootstrap the project
- Use `pnpm` for dependency management
- Adopt `shadcn/ui` for reusable UI primitives
- Keep the codebase small and easy to extend

## Tooling

- ESLint for code quality
- Prettier for formatting
- Husky for Git hooks
- lint-staged for pre-commit checks
- GitHub Actions for CI/CD

## High-Level Architecture

- **Frontend:** Next.js App Router
- **Backend:** Next.js route handlers and server actions
- **Database:** PostgreSQL with Prisma
- **Authentication:** Auth.js

## Folder Structure

- `app/` — pages, layouts, and route-level components
- `components/` — shared UI components
- `features/` — feature-specific components and pages
- `lib/` — utilities, service wrappers, and shared logic
- `hooks/` — reusable custom hooks
- `types/` — shared TypeScript definitions
- `prisma/` — database schema and migrations
- `public/` — static assets

## Module Boundaries

- Keep feature logic contained in `features/<area>/`
- Shared UI lives in `components/ui/`
- Domain services and application logic live in `lib/`
- Avoid cross-feature dependencies whenever possible

## Service Layer Design

- Use thin service wrappers for data access and domain logic
- Keep services small, testable, and side-effect free
- Server actions can call service functions directly

## Database Layer Design

- Model core entities clearly in Prisma
- Use normalized relationships for users, games, progress, and rewards
- Keep schema changes incremental and migration-driven

## State Management

- Prefer local React state and server-side data fetching
- Use global state only for session or persistent UI state
- Keep client-side state minimal to reduce complexity

## Security Architecture

- Secure routes and handlers with Auth.js session checks
- Validate all incoming data on the server
- Keep secrets in `.env`
- Avoid platform-specific APIs

## Error Handling

- Use structured errors in service and handler layers
- Catch async failures and return friendly messages
- Surface errors clearly in the UI without exposing internals

## Logging Strategy

- Keep server logging focused on exceptions and critical app events
- Avoid verbose client-side logging
- Use logs for operations and failures only

## Future Scaling Path

- Start simple, then add features by creating new `features/` modules
- Avoid premature optimization
- Keep the platform infrastructure-agnostic
- Grow the data model only as feature needs evolve
