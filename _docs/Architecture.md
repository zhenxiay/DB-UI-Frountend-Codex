# Personal Finance App — v1 Architecture and Scope

## Purpose

Build a simple, desktop-oriented personal-finance web application for one user. It will display and manage personal financial data in a local SQLite database.

## Deployment and access

- The app runs locally on the user's computer and listens only on `localhost`.
- The SQLite database is created automatically on first launch and remains local to that computer.
- Access requires sign-in through a work or school Microsoft Entra account.
- Only the user's explicitly allowlisted Entra account may sign in.
- The interface is designed for desktop and laptop screens only.
- The first version uses EUR with two decimal places and German dates (`DD.MM.YYYY`).

## Functional scope

### Accounts

- Create, view, edit, and delete accounts.
- Support any account label or type, including checking, savings, and credit-card accounts.
- Capture an opening balance while creating an account.
- Calculate each account balance from its opening balance and its transactions.
- Treat credit-card accounts with the same simple calculated-balance model as other accounts.
- Deleting an account deletes its transactions after a confirmation dialog; audit records remain.

### Transactions

- Create, view, edit, and delete income and expense transactions.
- Require transaction date, entry date, account, income/expense type, EUR amount, and category.
- Also support an optional payee or merchant name and notes.
- Do not support transfers, split transactions, attachments, recurring transactions, or planned transactions in v1.
- Confirm before deletion. Deleted transaction data remains represented in the immutable audit trail.

### Categories

- Provide a practical, fixed built-in category set for income and spending.
- Require a category for every transaction.
- Category customization is out of scope for v1.

### Browsing and dashboard

- Show transactions in a searchable, sortable table.
- Provide date-range, account, and category filters.
- Show current account balances and recent transactions on the dashboard.
- Show a spending-by-category chart for a user-selected month.

### Audit and backup

- Store immutable audit events for creates, edits, and deletions, including the authenticated user and before/after data where applicable.
- Do not provide an audit-history screen in v1.
- Support manual backup by copying or exporting the SQLite database file.
- CSV import and CSV export are out of scope for v1.

## Data model

The initial data model consists of these tables:

- `accounts`: account identity, name/type label, opening balance, and lifecycle metadata.
- `transactions`: account reference, income/expense type, amount, transaction date, entry date, category reference, payee, notes, and lifecycle metadata.
- `categories`: seeded, read-only built-in categories.
- `audit_events`: immutable records of changes, including actor, timestamp, action, entity identity, and change data.

Only accounts and transactions are user-managed data in v1. Categories are seeded application data, and audit events are written internally.

## Technology stack

The selected implementation is a local Next.js application with a TypeScript frontend and server layer in one project.

- **Framework:** Next.js with TypeScript.
- **Authentication:** Auth.js using a Microsoft Entra provider. The authenticated identity must match the configured single-user allowlist before the app permits access.
- **Database:** a local SQLite file, created on first launch.
- **Database access:** Drizzle ORM with a typed SQLite schema and migrations.
- **Validation:** Zod at server boundaries for account and transaction inputs, and for any external authentication data used by the application.
- **UI:** Tailwind CSS with accessible, reusable UI components (for example, shadcn/ui) for tables, dialogs, forms, filters, and confirmation prompts.
- **Charts:** Recharts for the selectable-month spending-by-category dashboard chart.
- **Testing:** Vitest for unit and integration tests, React Testing Library for component behavior, and Playwright for browser acceptance tests.

### Trust boundaries

- React components must not access SQLite directly.
- Database access, audit-event creation, authorization checks, and input validation must run only in server-side code.
- Every create, update, and delete operation must validate input, verify the Entra allowlist, persist the intended data change, and write its audit event atomically where supported.
- The local server must bind only to `localhost`.

### Entra connectivity

The application and SQLite data remain local, but Microsoft Entra sign-in requires an internet connection to complete authentication with Microsoft.

## Deferred backlog

- Account-to-account transfers.
- CSV import and export.
- Receipt attachments.
- Recurring and planned transactions.
- Budgets and category spending limits.
- Multiple currencies and exchange rates.
- Editable category management.
- An audit-history viewer.
- Mobile layouts, cloud hosting, home-network access, and multi-user support.
