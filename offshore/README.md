# Offshore Contractor Timesheets

A separate, simple app for service companies whose technicians work offshore. One timesheet per **trip (hitch)**,
signed by the technician and approved by the **client's supervisor through a secure link**: no account needed.

It lives in this folder as its own app (own settings, own web address). It reuses the sign-in, signature, PDF, Excel and
download code from the timesheet app in the folder above.

## Try the demo

Run it (see below), open http://localhost:3100 and tap a name on the sign-in screen:

| Who | PIN | What to try |
| --- | --- | --- |
| **Aisha Bello** | 1234 | Her trip was **queried** by the client. Fix the highlighted day, sign and resend. |
| **Priya Shah** | 1234 | Offshore now, trip half filled in. Tick "pretend this phone has no signal" and keep working. |
| Callum Reid, Ewan Murray, Kasia Nowak, Liam O'Neill | 1234 | Trips waiting, approved, ready to invoice, invoiced |
| **Office Demo** | 0000 | Dashboard, trip details, exports. "Reset demo" puts everything back. |

To act as the client's supervisor, open the link from a sent trip ("Open the supervisor's page").
In this demo stage the link only works in the same browser; stage 2 makes it work on any device.

Demo company: Granite Offshore Services, 6 technicians on 2 installations (Corrie Alpha for Northfield Energy, Brightwater
FPSO for Sealark Petroleum). All names and companies are made up.

## How it works

1. **Trip:** installation, client, PO number, work order / cost code, first and last day.
2. **Days pre-filled** (12h day or night shifts, travel at either end). Technicians only change the exceptions: night shift,
   travel, standby / weather, off, sick, or custom hours, with an optional note.
3. **Works offline:** everything saves on the phone first and sends itself when there's signal. The bar at the top always
   says whether it has reached the office.
4. **Sign and send:** tick the declaration, sign with a finger, enter the supervisor's name and email. The app writes the
   email in the technician's own email app (free; waits in the outbox with no signal).
5. **Supervisor's link:** opens on any phone or computer. **Approve** (name, email, signature, time recorded; the trip
   locks) or **Query** a specific day with a comment (goes back to the technician to fix and resend).
6. **Office dashboard:** awaiting approval, queried, approved, ready to invoice (plus invoiced and not sent yet).
7. **Exports:** payroll Excel (days and hours per person per trip, per person, every day), invoicing Excel (by client,
   PO and cost code with subtotals), and the signed PDFs (one per trip, or all in one file).

Hours per kind of day (e.g. travel = 8h), company name, colours and the declaration wording are in
[`src/config/settings.ts`](src/config/settings.ts).

## Build stages

| Stage | What you get | Accounts / cost |
| --- | --- | --- |
| **1. Working demo** ✅ | Everything above, saved in the browser, with a pretend server for syncing and approvals. | None |
| 2. Database | Real server (Supabase): sign-in checked on the server, trips synced between phone and office, supervisor links work on any device, office records stored safely. | Supabase account (free tier is enough to start) |
| 3. Automatic emails (optional) | The app emails the supervisor itself, sends reminders, and emails the signed PDF to the office when approved. | Resend account (free tier) + a domain to send from |
| 4. Go live | Own web address, installable on phones. | Vercel (free tier to start) |

## Running it on your own computer

1. Install [Node.js](https://nodejs.org) (the "LTS" version).
2. In a terminal, in this `offshore` folder: `npm install` (once), then `npm run dev`.
3. Open http://localhost:3100. Use your browser's phone view to see it as a technician would.

When it goes live on Vercel, it's a **separate Vercel project** with "Root Directory" set to `offshore`.
