# Timesheets

A mobile-first weekly timesheet app for small trades businesses. Workers fill in and sign their week on their phone; the payroll team approves and exports from a desktop dashboard.

**Rebranding:** everything company-specific (name, logo, colours, payroll email, overtime threshold, declaration wording) lives in [`src/config/brand.ts`](src/config/brand.ts). Replace `public/logo.svg` with your own logo.

## Showing the demo to a business

Demo logins: worker **Demo Worker / 1234**, office **Office Demo / 0000** (payroll dashboard at `/payroll`).

The demo uses the generic name "Your Company". To show a business its own name, send a link like:

`https://<your-app>.vercel.app/?company=Smith%20Joinery`

(`%20` means a space.) The name is remembered on that device. Open `/?company=` to go back to the default.

**Test companies:** `/?demo=nicol` switches a device to the Nicol of Skene test company (their logo and colours, 5 test workers, their own job numbers). `/?demo=` switches back. Any web address containing `nicol` (e.g. `nicolofskene-timesheets.vercel.app`, added in Vercel → Settings → Domains) opens as Nicol of Skene automatically, with no `?demo=` needed. Test companies are set up in [`src/config/demo-companies.ts`](src/config/demo-companies.ts).

## Build stages

| Stage | What you get | Accounts needed |
| --- | --- | --- |
| **1. Worker screens (demo)** ✅ | Name + PIN sign-in, week entry with several job numbers per day, auto-calculated hours & overtime, review, declaration, finger signature, submit, reference number, past weeks. Saves in the browser only. | None |
| 2. Accounts & database | Supabase (London region): sign-in with name + 4-digit PIN (checked on the server, PINs stored scrambled, lock-out after repeated wrong guesses), timesheets stored securely, row-level security, signatures in storage. | Supabase |
| 3. Signed PDF email | On submit, a signed PDF is emailed to the payroll inbox. | Resend (+ a domain to send from) |
| 4. Payroll dashboard | Weekly stats, filters, worker detail + signature, approve, reminders, signed PDF downloads, and one Excel file per week with three tabs: **Weekly hours** (payroll), **Hours by job**, and **Job costing import** (one row per employee per job per day). **Demo version done ✅** (made-up team). | — |
| 5. Admin & PWA | Add/remove workers, set/reset PINs, payroll access. **Home-screen icons done ✅** (per company: `public/icons/<company>/`). | — |
| 6. Go live | Hosted on Vercel with your web address. | Vercel |

## Vessel mode (marine companies)

For companies with a fleet: one person on each vessel fills in a **trip sheet** for everyone on board, the master signs it at the end of the trip, and the office approves it. Used on a computer (desktop/laptop), not a phone.

**Structure:** Company → Vessels → Trips (vessel, mob date, demob date, client, job number) → Crew on that trip (each with their own join and leave dates). One company-wide personnel list (name, rank, staff or agency).

**Try it:** open `/?demo=marine` (North Sea Marine: 3 vessels, 25 personnel, 9 trips). Any web address containing `marine` opens it automatically. Logins:
- Vessels: **Northern Star / 1111**, **Sea Venture / 2222**, **Ocean Pioneer / 3333** (Ocean Pioneer is alongside, so you can start a new trip there)
- Office: **Office Demo / 0000**

To set a real company up in vessel mode, set `appMode: "vessel"` in [`src/config/brand.ts`](src/config/brand.ts). Shift types (day, night, travel, standby, sick, off), default hours and ranks are in [`src/config/vessel.ts`](src/config/vessel.ts) – that's where the columns from the company's current Excel sheet get matched.

| Stage | What you get |
| --- | --- |
| **1. Structure, crew & demo fleet** ✅ | Vessel sign-in, start a trip (copy crew from the last trip or start empty), add crew from the personnel list, crew changes mid-trip (join/leave dates per person), clash checks (dates outside the trip, someone already on another vessel), demo fleet. Office: read-only fleet overview and personnel list. |
| **2. Daily grid** ✅ | Crew × days grid, pre-filled with the default (12h day shift, travel on join/leave days). Click, drag or Shift+click to select cells (or click a name or date for a whole row or day), then type D/N/T/S/X/O or use the buttons; set hours; Delete resets to the default. Changed cells are marked. Totals per person (days, days of each shift, hours) and per day (people on board, hours). Standard columns for now; they can be matched to the company's spreadsheet later in `src/config/vessel.ts`. |
| 3. Sign, submit & offline | **Sign & submit done ✅:** "Sign & submit" tab with totals per person, crew problems block signing, master's name, declaration, on-screen signature; resubmitting a queried sheet marks its queries answered. **Still to do:** syncing when there's a connection, with a clear "synced / waiting to sync" indicator. |
| **4. Office dashboard** ✅ | Fleet dashboard (vessels at sea, people on board now, sheets waiting for approval with a Review button, every trip clickable). Trip review: totals, master's signature, the full daily sheet, **Approve** (locks the trip) or **Query this line** (optionally a single day) with a comment; queried lines show in red on the vessel's sheet until it's signed and sent back. |
| 5. PDFs, exports & personnel | Signed PDF of each trip sheet. Excel exports: payroll (hours/days per person per trip) and invoicing (by vessel, trip and job number). Office adds/edits personnel and imports the list from Excel. |
| 6. Accounts, database & go live | Same as the trade app: Supabase sign-in and storage, real syncing between vessels and office, hosted on Vercel. |

## Running it on your own computer

1. Install [Node.js](https://nodejs.org) (the "LTS" version).
2. Download this project, open a terminal in its folder and run `npm install` (once), then `npm run dev`.
3. Open http://localhost:3000 in your browser. Use your browser's phone view (or shrink the window) to see it as a worker would.
