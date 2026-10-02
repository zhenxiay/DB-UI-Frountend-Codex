# Personal Finance App — Implementation Backlog

Tasks are intentionally small and ordered by their normal dependency path. Each issue includes the context needed to implement it without reading other backlog items. Before work begins, follow `_docs/process_tasks.md`: a PM grooms the selected issue, an engineer implements it, and QA verifies its acceptance criteria.

## 1. Scaffold the local Next.js application
Goal: Create an empty runnable TypeScript Next.js project with one passing test.
Description: Initialize only the project foundation needed to run the application and prove the test runner works. Do not implement authentication, SQLite, or any finance feature in this task.

Scope:

- Initialize Next.js with the App Router and TypeScript under the repository root.
- Configure the project scripts for `dev`, `lint`, `test`, `test:e2e`, and `build`.
- Add the conventional folders: `src/app`, `src/components`, `src/server`, and `src/lib`.
- Add a minimal homepage that identifies the application as a local personal-finance app.

Acceptance criteria:

- `npm run dev`, `npm run lint`, and `npm run build` complete successfully.
- The application opens at `http://localhost` and renders the baseline page.
- No database, authentication, or production financial feature is implemented in this task.

## 2. Add repository-wide formatting, linting, and test foundations
Goal: Establish consistent code quality and test tooling for the TypeScript application.
Description: Configure the checks that contributors will run before handing work to QA. Keep this task limited to tooling and a small test fixture rather than product behavior.

Scope:

- Configure ESLint and Prettier for TypeScript, React, and Tailwind-compatible source files.
- Configure Vitest and React Testing Library with one passing smoke test.
- Configure Playwright with a single placeholder browser test that verifies the homepage loads.
- Document the exact commands in `README.md`.

Acceptance criteria:

- `npm run lint`, `npm run format:check`, `npm run test`, and `npm run test:e2e` are defined and pass.
- The smoke tests use no live Microsoft credentials or external services.
- Formatter and lint configuration do not modify unrelated documentation.

## 3. Add local configuration and startup documentation
Goal: Define safe local configuration for SQLite and Microsoft Entra without committing secrets.
Description: Document the configuration contract and prevent local credentials or financial data from entering Git. This task does not configure a live Entra application or create a production database.

Scope:

- Add `.env.example` with documented names for the SQLite path, Auth.js secret, Entra tenant/client identifiers, and the single allowed user identity.
- Add `.gitignore` rules for `.env*` (except the example), SQLite files, SQLite WAL/SHM files, and local backup files.
- Document first-run setup, Entra redirect URI requirements for localhost, and where the database file is stored.

Acceptance criteria:

- A developer can identify every required environment variable from the example and documentation.
- No credential, populated SQLite database, or real Entra identifier is committed.
- Documentation states that Entra sign-in needs internet access even though app data is local.

## 4. Configure Drizzle and a local SQLite connection
Goal: Provide a server-only, typed SQLite connection and migration workflow.
Description: Set up the database tooling and connection boundary that later server features will use. It must be possible to verify the connection with a temporary test database rather than a user's financial data.

Scope:

- Install and configure Drizzle ORM, its SQLite driver, and migration tooling for Next.js.
- Put database connection and migration configuration in server-only modules.
- Read the database location from validated environment configuration.
- Add a small automated check that opens a temporary SQLite database without using a real user database.

Acceptance criteria:

- The application can create/open a configured SQLite database path locally.
- Browser bundles cannot import the SQLite connection module.
- A documented command creates and applies schema migrations.

## 5. Create the initial SQLite schema and migrations
Goal: Define the persistent tables for accounts, transactions, categories, and audit events.
Description: Add the initial Drizzle schema and migration files for the agreed v1 data model. The schema must preserve money precisely and retain audit snapshots even after ordinary records are deleted.

Scope:

- Create Drizzle schema definitions and migrations for `accounts`, `transactions`, `categories`, and `audit_events`.
- Use integer minor units for EUR amounts to avoid floating-point accounting errors.
- Include identifiers, timestamps, foreign keys, useful indexes, and lifecycle fields needed for the agreed behavior.
- Ensure deletion of an account removes its transactions while audit records remain valid snapshots rather than foreign-key-dependent rows.

Acceptance criteria:

- A clean database migrates successfully and contains exactly the four core tables.
- Transactions reference an account and a category; audit events remain readable after a related record is deleted.
- The schema supports transaction date, entry date, income/expense type, amount, payee, notes, and an account opening balance.

## 6. Seed the fixed built-in category set
Goal: Populate a practical, read-only income and spending category list on first database setup.
Description: Provide a predictable set of built-in categories so every transaction can require one. This task seeds application data only and deliberately does not add category-management UI or mutations.

Scope:

- Define a small fixed category set suitable for a German personal-finance app, including income and common spending categories.
- Add an idempotent seed operation that runs after migrations or on first launch.
- Ensure categories cannot be created, edited, or deleted through v1 application interfaces.

Acceptance criteria:

- A new database receives the same category list exactly once.
- The category list contains values usable for both income and expenses.
- Re-running the seed operation creates no duplicate rows.

## 7. Integrate Microsoft Entra authentication
Goal: Require a work or school Microsoft Entra sign-in before showing private finance data.
Description: Add the authentication plumbing and route protection for the local application. Use mockable configuration and tests so automated checks never call a real Microsoft tenant.

Scope:

- Configure Auth.js and the Microsoft Entra provider using environment variables.
- Add sign-in, sign-out, callback, and session handling appropriate for a localhost-only app.
- Protect the application routes so unauthenticated requests are redirected to sign-in.

Acceptance criteria:

- Unauthenticated visitors cannot access dashboard, account, or transaction routes.
- A mocked authentication test verifies the protected-route behavior without live Microsoft access.
- Documentation identifies the localhost callback URL to configure in Entra.

## 8. Enforce the single-user Entra allowlist
Goal: Restrict the app to the one explicitly configured Entra account.
Description: Add a reusable server-side authorization rule that checks the authenticated identity against the configured allowed user. Authentication alone is not sufficient; a signed-in but non-allowed identity must be denied.

Scope:

- Validate the authenticated Entra identity against the configured allowlist at sign-in and on protected server operations.
- Reject an authenticated but non-allowlisted account with a clear access-denied response.
- Keep authorization logic in a reusable server-only module.

Acceptance criteria:

- Tests cover allowed, missing, and non-allowed user identities.
- No create, update, or delete server operation can run without passing the allowlist check.
- The UI does not reveal financial data to a rejected user.

## 9. Build the audit-event service
Goal: Provide a reusable immutable audit mechanism for all financial data changes.
Description: Create the server-only service that records who changed which financial entity and the relevant before/after data. It records data for later review but does not create an audit-history screen.

Scope:

- Define a server-only audit service that records actor identity, timestamp, action, entity type, entity ID, and before/after snapshots.
- Provide typed helpers for create, update, and delete events.
- Document that audit rows are internal-only in v1; no audit-history screen is required.

Acceptance criteria:

- Audit payloads preserve deleted entity data without relying on a live foreign-key reference.
- Tests show audit events cannot be updated or deleted through the application service.
- The service accepts the authenticated Entra identity rather than a browser-supplied actor value.

## 10. Create the application shell and navigation
Goal: Implement the authenticated desktop layout for dashboard, transactions, and accounts.
Description: Build the shared navigation and signed-in frame used by the three primary v1 routes. Keep it limited to desktop/laptop use and do not implement the underlying financial data views here.

Scope:

- Add a desktop-oriented shell with navigation links for Dashboard, Transactions, and Accounts.
- Add a visible signed-in user area and sign-out control.
- Implement responsive guardrails suitable for desktop/laptop use; mobile-first support is not in scope.

Acceptance criteria:

- All three primary routes are reachable through keyboard-accessible navigation.
- The active route is visibly indicated.
- Unauthenticated users cannot render the shell.

## 11. Implement account validation and server-side mutations
Goal: Safely create, update, and delete accounts on the server.
Description: Implement validated, authorized account mutations with transactional audit recording. Deleting an account must remove its related transactions while retaining snapshots needed by the audit trail.

Scope:

- Define Zod validation for account name/type label and EUR opening balance.
- Implement server-side create, update, and delete operations using Drizzle.
- On delete, remove dependent transactions and create immutable audit snapshots for the deleted account and affected transactions in one database transaction.

Acceptance criteria:

- Invalid names or amounts are rejected with field-level errors.
- Each successful create, update, and delete writes the required audit event(s).
- Database changes and their audit events commit together or not at all.

## 12. Build the account management interface
Goal: Let the signed-in user manage accounts and opening balances from the browser.
Description: Build the account list and forms that call the already-authorized account mutation layer. Deletion must be an explicit, accessible confirmation action.

Scope:

- Render an account list with account name/type, opening balance, and calculated current balance placeholder or query result.
- Add accessible create and edit forms.
- Add a destructive-action confirmation dialog before account deletion.
- Display server validation errors in the relevant form fields.

Acceptance criteria:

- A user can create and edit an account using keyboard and mouse.
- Account deletion requires an explicit confirmation and reports success/failure clearly.
- The interface does not expose fields for category management or account-to-account transfers.

## 13. Implement transaction validation and server-side mutations
Goal: Safely create, update, and delete financial transactions on the server.
Description: Implement validated, authorized transaction mutations with audit recording in the same database transaction. This task owns the server contract, not the visual transaction form.

Scope:

- Define Zod validation for account, category, income/expense type, EUR amount, transaction date, entry date, optional payee, and optional notes.
- Require all agreed mandatory fields and confirm referenced account/category rows exist.
- Implement create, update, and delete operations with audit events in the same SQLite transaction.

Acceptance criteria:

- Invalid dates, zero/invalid amounts, missing categories, or unknown references are rejected.
- A successful mutation creates exactly the corresponding immutable audit event.
- The browser never sends an audit actor or bypasses the server authorization check.

## 14. Build the transaction entry and edit form
Goal: Provide an accessible form for entering and editing income and expense transactions.
Description: Build a browser form around the transaction mutation contract with all agreed fields and validation feedback. Keep excluded v1 features such as transfers, splits, receipts, and recurring entries out of the interface.

Scope:

- Add fields for type, amount, account, category, transaction date, entry date, optional payee, and optional note.
- Display built-in categories as a required selection.
- Use German date presentation and EUR amount presentation while preserving unambiguous submitted values.
- Reuse the same form structure for editing an existing transaction.

Acceptance criteria:

- The form prevents submission until required values are valid.
- Server validation failures are shown to the user without losing valid entered values.
- The form has no controls for transfers, splits, receipts, recurring payments, or custom categories.

## 15. Implement the transaction browsing query API
Goal: Expose authorized server-side transaction queries with search, sort, and required filters.
Description: Build a typed query layer that returns transactions joined with their account and category display data. Validate every filter and sorting input on the server before it reaches SQLite.

Scope:

- Implement a typed query service returning transactions with account and category display data.
- Support text search and date-range, account, and category filters.
- Support a safe allowlisted set of sort fields and directions, defaulting to newest transaction date first.
- Validate all query parameters on the server.

Acceptance criteria:

- Tests cover each filter alone and in combination, plus sorting and empty results.
- An invalid filter or sort value is rejected or safely replaced by a documented default.
- Results never contain records from an unauthorized request.

## 16. Build the transaction table and filters
Goal: Let the user browse, search, sort, and filter financial transactions.
Description: Render the transaction query results in an accessible desktop table and connect its controls to the supported query options. Editing and deletion controls may launch their flows, but the mutation logic remains server-side.

Scope:

- Render a transaction table showing payee, account, category, transaction date, and signed EUR amount.
- Add a search field and filters for date range, account, and category.
- Add sortable columns using the supported server query options.
- Add controls to open edit and deletion flows for each transaction.

Acceptance criteria:

- Applying or clearing a filter updates the table and communicates the active state accessibly.
- The default view lists newest transactions first.
- Empty and loading states are understandable and do not resemble a data error.

## 17. Add transaction deletion confirmation and feedback
Goal: Make destructive transaction deletion deliberate and clearly communicated.
Description: Add the focused confirmation and feedback behavior required before a transaction can be removed. Reuse the existing authorized delete mutation and ensure visible data refreshes afterward.

Scope:

- Add an accessible confirmation dialog describing the selected transaction before deletion.
- Invoke the authorized server-side delete operation only after explicit confirmation.
- Refresh affected transaction and balance views after success; present a recoverable error message on failure.

Acceptance criteria:

- Closing or cancelling the dialog does not modify data.
- Confirming deletion removes the transaction from the list and creates its audit event.
- Keyboard focus is managed correctly while the dialog is open and after it closes.

## 18. Implement account balance calculations
Goal: Calculate current balances from opening balances and persisted transactions.
Description: Implement one authoritative server-side calculation for account balances. It must use stored integer minor units and apply the agreed rule that income increases, while expenses decrease, the balance.

Scope:

- Implement a server-side balance query that combines an account opening balance with income and expense transactions.
- Define and test the signed-amount rule: income increases the balance and expense decreases it.
- Use integer minor units internally and format results only at the presentation layer.

Acceptance criteria:

- Tests cover no transactions, mixed income/expense transactions, and negative balances.
- The same calculation is used by account and dashboard queries.
- No floating-point arithmetic is used for stored or calculated money values.

## 19. Implement dashboard summary queries
Goal: Supply the dashboard with balances, recent transactions, monthly totals, and category spending data.
Description: Create server-side read models for the dashboard without mixing data access with JSX or locale formatting. The selected-month rules must be explicit and covered by tests.

Scope:

- Create authorized server-side queries for total balance, per-account balances, recent transactions, selected-month income, selected-month expenses, and spending grouped by category.
- Define selected-month handling with a safe default to the current month.
- Return presentation-neutral data; do not embed JSX or locale formatting in query services.

Acceptance criteria:

- Tests verify month boundaries and transactions in the selected month only.
- Expense-by-category results exclude income transactions.
- Query results can be rendered without fetching the database from browser code.

## 20. Build the dashboard summary and account widgets
Goal: Present the main financial overview on the dashboard route.
Description: Render the summary cards, account balances, and recent transactions using the dashboard read models. This task handles display and empty states, not chart rendering or new database calculations.

Scope:

- Render total balance, selected-month income, selected-month expenses, and available amount summary cards.
- Render per-account calculated balances and a recent-transactions list.
- Format all dates as `DD.MM.YYYY` and all values as two-decimal EUR amounts.

Acceptance criteria:

- Dashboard values match the server-side query fixtures in component tests.
- Negative values are distinguishable without relying on color alone.
- The route renders sensible empty states for a newly created database.

## 21. Add the monthly category-spending chart
Goal: Visualize selected-month spending by category on the dashboard.
Description: Add the chart and month selector using the established grouped-expense read model. Provide an accessible non-visual representation of the same values.

Scope:

- Add Recharts and render a spending-by-category chart using the dashboard query result.
- Provide a selected-month control and reload chart data when it changes.
- Add an accessible text alternative or data table for the chart values.

Acceptance criteria:

- Changing the month changes the chart and its accessible alternative.
- Categories with no spending are handled without chart errors.
- The chart represents expenses only and matches the grouped server query result.

## 22. Add manual SQLite backup guidance and UI affordance
Goal: Make manual local backups discoverable without adding cloud or CSV backup features.
Description: Add a small signed-in help or settings surface explaining how to safely copy the local SQLite file. The task must not implement data upload, cloud backups, or CSV export.

Scope:

- Add a settings/help surface explaining the configured SQLite database location and how to copy it safely as a backup.
- Include a warning to close the app or follow the documented SQLite-safe backup procedure before copying a live database.
- Do not upload data, create cloud backups, or add CSV export.

Acceptance criteria:

- A user can find the database location and backup instructions from the signed-in interface.
- Documentation and UI explicitly describe backups as local manual copies.
- No backup action transmits financial data over the network.

## 23. Restrict the local server to localhost and document release operation
Goal: Ensure the app is operated as a private local service and can be started safely.
Description: Configure and document development and release startup so the service is loopback-only by default. Include the operational checks a user needs before upgrading or releasing the local app.

Scope:

- Configure/document development and production startup so the service binds to loopback only.
- Add a release checklist covering environment variables, database migration, backup, and Entra redirect URI verification.
- Add a basic automated check or documented manual verification for the localhost-only binding.

Acceptance criteria:

- The documented production command does not expose the app on the home network by default.
- The release checklist includes backup and migration steps.
- No production startup command requires a live secret in source control.

## 24. Add end-to-end coverage for the primary finance flow
Goal: Verify the highest-risk user journey using controlled local test data and mocked authentication.
Description: Automate the main account-and-transaction flow from sign-in fixture through a confirmed deletion. The test must run against a disposable local SQLite database and never use real Entra credentials or finance data.

Scope:

- Create a Playwright flow that signs in through a test auth fixture, creates an account, enters a transaction, verifies the balance/dashboard, edits or deletes the transaction, and verifies the result.
- Add coverage that confirms a deletion requires confirmation.
- Keep all browser tests offline from real Entra and free of real financial data.

Acceptance criteria:

- The primary flow passes in a clean temporary SQLite database.
- The test verifies visible results after each mutation and not just HTTP responses.
- CI-friendly test setup cleans up only its own temporary database files.

## 25. Perform a security and data-integrity review
Goal: Validate that v1 meets its local-data, authorization, and audit requirements before release.
Description: Review the completed application against its agreed security and data-integrity boundaries, then run the full verification suite. Record any gap as a new backlog item rather than silently accepting it.

Scope:

- Review route protection, allowlist enforcement, server-only SQLite imports, Zod validation, destructive-action confirmations, and audit-event behavior.
- Verify no credential, database file, or financial fixture is tracked by Git.
- Execute the full lint, unit, component, browser, and production-build checks.
- Record findings and any follow-up work in a short review note.

Acceptance criteria:

- All automated checks pass.
- The review confirms every financial mutation is authenticated, validated, authorized, and audited.
- Any unresolved finding is written as a new backlog task rather than silently deferred.

## 31. Use OIDC scopes for Entra sign-in without User.Read

Goal: Use OpenID Connect identity scopes for Microsoft Entra sign-in without requesting Microsoft Graph `User.Read`. Keep the localhost callback, single-user allowlist, and protected finance routes working.

Scope:

- Explicitly request `openid profile email` from Entra, with no Microsoft Graph scope.
- Override the provider's default profile behavior so sign-in does not request a Graph profile photo.
- Continue using validated OIDC identity claims for the allowlist and audit actor.
- Update setup documentation to explain that `User.Read` is not required and how to remove it from the app registration after checking sign-in.
- Add mocked authentication tests without real Entra credentials or Graph calls.

Acceptance criteria:

- The Entra authorization request includes `openid profile email` and no `User.Read` or other Graph scope.
- Sign-in does not call Microsoft Graph; allowed identities can sign in, while missing or non-allowlisted identities are denied.
- Protected server operations still enforce the single-user allowlist.
- Documentation explains the localhost callback and removal of the app registration's `User.Read` delegated permission.
