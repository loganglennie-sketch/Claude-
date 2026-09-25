# Timesheets

A mobile-first weekly timesheet app for small trades businesses. Workers fill in and sign their week on their phone; the payroll team approves and exports from a desktop dashboard.

**Rebranding:** everything company-specific (name, logo, colours, payroll email, overtime threshold, declaration wording) lives in [`src/config/brand.ts`](src/config/brand.ts). Replace `public/logo.svg` with your own logo.

## Build stages

| Stage | What you get | Accounts needed |
| --- | --- | --- |
| **1. Worker screens (demo)** ✅ | Name + PIN sign-in, week entry, auto-calculated hours & overtime, review, declaration, finger signature, submit, reference number, past weeks. Saves in the browser only. | None |
| 2. Accounts & database | Supabase (London region): sign-in with name + 4-digit PIN (checked on the server, PINs stored scrambled, lock-out after repeated wrong guesses), timesheets stored securely, row-level security, signatures in storage. | Supabase |
| 3. Signed PDF email | On submit, a signed PDF is emailed to the payroll inbox. | Resend (+ a domain to send from) |
| 4. Payroll dashboard | Weekly stats, filters, worker detail + signature, approve, reminders, PDF downloads, CSV export. | — |
| 5. Admin & PWA | Add/remove workers, set/reset PINs, payroll access, installable app with icon. | — |
| 6. Go live | Hosted on Vercel with your web address. | Vercel |

## Running it on your own computer

1. Install [Node.js](https://nodejs.org) (the "LTS" version).
2. Download this project, open a terminal in its folder and run `npm install` (once), then `npm run dev`.
3. Open http://localhost:3000 in your browser. Use your browser's phone view (or shrink the window) to see it as a worker would.
