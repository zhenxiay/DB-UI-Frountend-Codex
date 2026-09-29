# Repository Guidelines

## Product and Architecture

This repository will contain a local, single-user personal-finance application. The app runs on the user's computer, serves only `localhost`, stores data in SQLite, and requires a single allowlisted work or school Microsoft Entra account.

`_docs/Architecture.md` is the authoritative v1 scope and architecture. Read it before changing product behavior, data storage, authentication, or deployment assumptions. `_docs/tasks.md` is the local backlog mirror; the corresponding GitHub issues are the work queue.

V1 includes accounts, income/expense transactions, fixed built-in categories, calculated balances, dashboard summaries, a selected-month spending chart, manual SQLite backups, and immutable internal audit events. Transfers, CSV import/export, attachments, recurring transactions, budgets, multi-currency support, editable categories, cloud hosting, mobile support, and an audit-history UI are out of scope unless a task explicitly adds them.

## Project Structure

The application has not yet been scaffolded. Task #1 establishes the initial Next.js project. When source code is added, use this layout:

- `src/app/`: App Router routes, layouts, and route-specific UI.
- `src/components/`: reusable client and server React components.
- `src/server/`: server-only database, authentication, authorization, audit, and query/mutation services.
- `src/lib/`: shared types, formatting utilities, constants, and validation schemas that are safe to share.
- `drizzle/`: generated SQL migrations only.
- `tests/`: shared test setup and fixtures; colocated tests are also acceptable when clearer.
- `_docs/`: architecture, process, task templates, and team instructions.

Keep SQLite drivers, Drizzle queries, Entra configuration, authorization decisions, and audit writes out of client components. Mark server-only modules appropriately and do not import them into browser code.

## Selected Technology Stack

- Next.js App Router and TypeScript.
- Auth.js with the Microsoft Entra provider.
- Drizzle ORM and a local SQLite database.
- Zod for server-boundary validation.
- Tailwind CSS and accessible reusable UI components.
- Recharts for the monthly category-spending chart.
- Vitest, React Testing Library, and Playwright for verification.

Do not substitute a framework, ORM, authentication provider, database, or charting library without an approved architecture change.

## Build, Test, and Development Commands

There is no scaffolded Node.js application yet. Do not invent or run package commands until Task #1 adds `package.json` and the scripts below.

After scaffolding, keep this guide aligned with `package.json`:

```bash
npm run dev          # run the local Next.js server
npm run lint         # run static checks
npm run format:check # verify formatting
npm run test         # run Vitest unit and component tests
npm run test:e2e     # run Playwright browser tests
npm run build        # create a production build
```

The local app must bind to loopback only. Do not add a container deployment, network binding, cloud deployment, or public URL unless the product scope changes.

## Coding Conventions

Use TypeScript for all application and server code. Use two-space indentation, single-purpose modules, explicit types at public boundaries, and named exports where practical.

- Use `PascalCase` for React components and types.
- Use `camelCase` for functions, variables, and object properties.
- Use `kebab-case` for route segments and non-component filenames.
- Use Zod to validate every server mutation and externally sourced authentication value used by the app.
- Store and calculate EUR amounts as integer minor units; never use floating-point values for financial data.
- Format money and dates only at the UI boundary: EUR with two decimals and `DD.MM.YYYY` dates.

Use the configured formatter and linter when available. Do not reformat unrelated files.

## Data, Authorization, and Audit Rules

- SQLite is local application data. Never commit a populated database, database backups, WAL/SHM files, or financial test data.
- The browser must never access SQLite directly.
- Every account or transaction create, update, and delete operation must authenticate the session, enforce the Entra allowlist, validate input, and create its audit event server-side.
- Financial data changes and their audit events must use one database transaction where supported, so they commit or fail together.
- Audit events are immutable snapshots. They must remain meaningful after an account or transaction is deleted.
- Deleting accounts and transactions always requires an explicit confirmation in the UI.
- Categories are seeded, fixed application data in v1. Do not expose category CRUD.
- Never trust a browser-supplied user identity, audit actor, account ownership, category ID, sort field, or filter value.

Entra sign-in requires internet access to Microsoft, but the application database and server remain local. Do not add telemetry or transmit finance data to third parties.

## Testing Requirements

Use Vitest for units and server integration tests, React Testing Library for component behavior, and Playwright for browser acceptance tests. Name tests after the behavior being verified, for example `transaction-authorization.test.ts` or `account-deletion-confirmation.spec.ts`.

Test new behavior at its trust boundary. At minimum, cover validation, allowlist authorization, atomic audit creation, money calculations, account/transaction deletion, and dashboard date-boundary calculations when each is introduced.

Never use live Microsoft credentials, real Entra tenants, a real user's SQLite database, or real financial data in automated tests. Use controlled fixtures, mocked authentication, and temporary SQLite files owned by the test run.

Verification commands can take time to initialize, particularly Vitest and TypeScript checks. Unless a command reports a failure, allow up to 10 minutes for it to complete before treating it as hung; poll long-running commands every 30–60 seconds so their output remains observable.

## Task Workflow

Follow `_docs/process_tasks.md` and the relevant role guidance under `_docs/team/`.

1. Select one open GitHub issue.
2. PM grooms it against its acceptance criteria.
3. An engineer implements only that groomed issue.
4. The engineer stops at implementation handoff: leave the issue open, do not mark acceptance criteria complete, and comment with the implementation summary and any checks run during development.
5. QA independently verifies every acceptance criterion against the running result, makes no code changes, and posts the required PASS or FAIL verdict.
6. Only the orchestrator may close the issue, and only after a QA PASS comment is present. A user request to close does not replace the QA gate; if QA has not posted PASS, request QA first.

Read an issue's acceptance criteria before implementation and again before closure. Keep changes and pull requests focused on one issue. Use `_docs/task-template.md` for newly created tasks, and commit regularly with short imperative subjects, such as `Add transaction validation`.

## Configuration and Secrets

Keep real values only in local environment files that Git ignores. Document non-secret variable names in `.env.example`; likely values include the SQLite path, Auth.js secret, Entra tenant and client identifiers, and allowed Entra user identity.

Never commit secrets, session tokens, Auth.js secrets, Entra credentials, populated SQLite databases, or backups. If package installation or GitHub access fails with proxy authentication error 407, retry using the `localhost:3128` proxy.
