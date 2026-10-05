# Database (Supabase)

## Set-up (once)
1. Create a Supabase project in the **London (eu-west-2)** region.
2. Open **SQL Editor**, paste the whole of `migrations/20261004000000_phase1_backend.sql` and click **Run**.
3. Then do the same with `migrations/20261005000000_phase1_admin_tools.sql`, and then
   `migrations/20261006000000_nicol_form_fields.sql` (holiday/sick, travel, nights away, food, expenses, notes), and
   `migrations/20261007000000_workers_choose_pin.sql` (workers choose their own PIN at first sign-in).
4. Copy the keys listed in `/.env.example` into Vercel's environment variables (including `SUPER_ADMIN_EMAIL`).
5. **Authentication → Users → Add user**: your own email and a strong password (tick "Auto confirm").
6. Sign in at `/office` with it. The first time, it makes you the super admin and opens `/super`, where you add
   companies, their office admins, and (for test companies) a sample team with timesheets.

## What's in it
| Table | Holds |
| --- | --- |
| `companies` | Each customer, its web-address keywords and settings |
| `users` | Super admin, company admins (email + password) and workers (name + 4-digit PIN, stored as a bcrypt hash) |
| `timesheets` | One per worker per week: draft while being filled in, then submitted / approved |
| `job_entries` | One row per job, written and checked on submit (job number, start, finish, break, overnight, minutes) |
| `signatures` | The worker's signature and the declaration they ticked |
| `audit_log` | Every sign-in, lock-out, admin action, submission and approval. Can't be edited or deleted |

Security: row-level security on every table; apps can only read through those rules and every change goes through a
checked function. Nothing is ever deleted. 5 wrong PINs lock an account for 15 minutes.

## Testing locally
`tests/security-tests.sql` (69 checks), `tests/form-fields-tests.sql` (9) and `tests/choose-pin-tests.sql` (19) run on a
plain Postgres after `tests/local-supabase-stub.sql` and the migrations.
