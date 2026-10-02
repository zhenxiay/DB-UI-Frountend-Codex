# Personal Finance App

This is a local, single-user personal-finance application. It runs on the
local computer, stores finance data in SQLite, and permits only one configured
work or school Microsoft Entra identity to sign in. Finance data is not sent to
third parties. Microsoft Entra sign-in itself requires internet access to
Microsoft.

## Prerequisites

- Node.js 20.9 or later
- npm 10 or later
- A Microsoft Entra application registration for localhost sign-in

## First-run setup

1. Install the locked dependency set:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and replace every placeholder with
   local values. `.env.local` is ignored by Git and must never be committed.

3. Register this redirect URI in the Entra application under the Web platform:

   ```text
   http://localhost:3000/api/auth/callback/microsoft-entra-id
   ```

   If the app uses a different local port, register the matching port and use
   that same port when starting the app. Entra sign-in cannot complete without
   internet access.

   Under **API permissions**, Microsoft Graph `User.Read` is not required by
   this app. Sign-in requests only the OpenID Connect `openid profile email`
   scopes and reads identity claims from the ID token. After verifying that
   sign-in works with the localhost callback above, remove the delegated
   Microsoft Graph `User.Read` permission from the app registration under
   **API permissions**. The app does not request a Graph access token or a
   profile photo.

   If a fresh sign-in is denied, check the terminal running `npm run dev` for
   a line beginning `AUTH_DENIED:` followed by a reason code. Share only the
   code, not
   tokens, claim values, email addresses, identifiers, or environment values:
   `ENTRA_CLAIMS_INVALID` means an OIDC claim failed validation;
   `ENTRA_SUBJECT_MISSING` means the stable subject is absent or blank;
   `ENTRA_SUBJECT_MISMATCH` means the validated subject differs from the provider
   account ID; `ENTRA_CALLBACK_UNSUPPORTED` means the callback lacks the
   expected Entra OIDC account; and `ENTRA_ALLOWLIST_MISMATCH` means a valid
   identity does not match the configured allowlist. The browser shows only a
   generic denial. Restart the local server after changing authentication code
   before trying again.

4. Start the local server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) and sign in with the
   identity configured in `ENTRA_ALLOWED_USER` or `ENTRA_ALLOWED_OBJECT_ID`.

The application listens on `127.0.0.1` during local development. Do not use a
network-facing host binding for this local application.

## Configuration

All required local configuration names are listed in `.env.example`:

| Variable                  | Purpose                                              |
| ------------------------- | ---------------------------------------------------- |
| `SQLITE_PATH`             | Local SQLite database file path.                     |
| `AUTH_SECRET`             | Secret used by Auth.js to protect local sessions.    |
| `ENTRA_TENANT_ID`         | Microsoft Entra tenant identifier.                   |
| `ENTRA_CLIENT_ID`         | Microsoft Entra application client identifier.       |
| `ENTRA_CLIENT_SECRET`     | Local secret for the Entra application registration. |
| `ENTRA_ALLOWED_USER`      | Email or OIDC subject for the single allowed user.   |
| `ENTRA_ALLOWED_OBJECT_ID` | Optional Entra user Object ID; takes precedence.     |

Set `ENTRA_ALLOWED_USER` to the account's email address or stable OIDC `sub`.
An email allowlist matches the validated `email` claim, or the validated
`preferred_username` claim when `email` is absent. Matching ignores surrounding
whitespace and letter case. The `sub` claim is always required and remains the
session and audit actor identifier. If Entra supplies an `email` claim that does
not match, `preferred_username` is not used as a fallback.

If the email claims do not match your sign-in email, you may instead put your
Entra **user Object ID** in `ENTRA_ALLOWED_OBJECT_ID` in the ignored
`.env.local` file. Use the Object ID from the tenant configured by
`ENTRA_TENANT_ID`; it is distinct from the application client ID. When this
setting is present, sign-in and protected server operations require matching
validated OIDC `oid` and `tid` claims. `tid` must equal `ENTRA_TENANT_ID`.
Email, username, and subject cannot bypass this mode, even if
`ENTRA_ALLOWED_USER` is also set. The stable OIDC `sub` remains required and
is used for sessions and audit actors. Keep Object IDs out of issue comments
and source control. Restart the local server after changing `.env.local`, then
retry sign-in. `ENTRA_ALLOWLIST_MISMATCH` can also mean the Object ID or tenant
claim did not match in this mode; the diagnostic never prints those values.

The default database location is `./data/personal-finance.sqlite`, relative to
the repository root. The database and its SQLite `-wal`/`-shm` sidecar files
remain local and are ignored by Git. The path can be changed with
`SQLITE_PATH`; create backups only as local copies and keep them outside Git.

Never commit `.env.local`, credentials, session secrets, populated SQLite
files, SQLite sidecar files, or database backups.

## Audit events

Account and transaction changes record immutable audit events containing the
authenticated Entra identity and before/after snapshots. Audit rows are an
internal server record in v1; the application does not provide an audit-history
screen or client-side audit controls.

## Database migrations

Generate a migration after changing `src/server/db/schema.ts`, then apply
pending migrations to the configured local database:

```bash
npm run db:generate
npm run db:migrate
```

Use a temporary `SQLITE_PATH` when verifying migrations; never run migration
tests against a user's populated database.

## Checks

```bash
npm run lint
npm run format:check
npm run test
npm run test:e2e
npm run build
```

Run `npm run format` to apply repository formatting.
