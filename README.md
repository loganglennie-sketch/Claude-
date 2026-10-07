# Timesheets

A mobile-first weekly timesheet app for small trades businesses. Workers fill in and sign their week on their phone; the payroll team approves and exports from a desktop dashboard.

> **Separate product:** [`offshore/`](offshore/README.md) holds *Offshore Contractor Timesheets* (trips approved by the client's supervisor by secure link). It's its own app with its own settings.

**Rebranding:** everything company-specific (name, logo, colours, payroll email, overtime threshold, declaration wording) lives in [`src/config/brand.ts`](src/config/brand.ts). Replace `public/logo.svg` with your own logo.

## Showing the demo to a business

Demo logins: worker **Demo Worker / 1234**, office **Office Demo / 0000** (payroll dashboard at `/payroll`).

The demo uses the generic name "Your Company". To show a business its own name, send a link like:

`https://<your-app>.vercel.app/?company=Smith%20Joinery`

(`%20` means a space.) The name is remembered on that device. Open `/?company=` to go back to the default.

**Full version demo:** `/?demo=elevatex` switches a device to the ElevateX Marketing showcase (logo, colours, 5 sample workers, job numbers, holiday/sick, nights away, food, travel, expenses and a paper-style PDF). `/?demo=` switches back. Any web address containing `elevatex` (added in Vercel → Settings → Domains) opens as it automatically. Demo companies are set up in [`src/config/demo-companies.ts`](src/config/demo-companies.ts).

## Build stages

| Stage | What you get | Accounts needed |
| --- | --- | --- |
| **1. Worker screens (demo)** ✅ | Name + PIN sign-in, week entry with several job numbers per day, auto-calculated hours & overtime, review, declaration, finger signature, submit, reference number, past weeks. Saves in the browser only. | None |
| 2. Accounts & database | Supabase (London region): sign-in with name + 4-digit PIN (checked on the server, PINs stored scrambled, lock-out after repeated wrong guesses), timesheets stored securely, row-level security, signatures in storage. | Supabase |
| 3. Signed PDF email | On submit, a signed PDF is emailed to the payroll inbox. | Resend (+ a domain to send from) |
| 4. Payroll dashboard | Weekly stats, filters, worker detail + signature, approve, reminders, signed PDF downloads, and one Excel file per week with three tabs: **Weekly hours** (payroll), **Hours by job**, and **Job costing import** (one row per employee per job per day). **Demo version done ✅** (made-up team). | — |
| 5. Admin & PWA | Add/remove workers, set/reset PINs, payroll access. **Home-screen icons done ✅** (per company: `public/icons/<company>/`). | — |
| 6. Go live | Hosted on Vercel with your web address. | Vercel |

## Running it on your own computer

1. Install [Node.js](https://nodejs.org) (the "LTS" version).
2. Download this project, open a terminal in its folder and run `npm install` (once), then `npm run dev`.
3. Open http://localhost:3000 in your browser. Use your browser's phone view (or shrink the window) to see it as a worker would.
