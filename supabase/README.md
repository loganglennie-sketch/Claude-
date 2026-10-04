# Database (Supabase)

## Set-up (once)
1. Create a Supabase project in the **London (eu-west-2)** region.
2. Open **SQL Editor**, paste the whole of `migrations/20261004000000_phase1_backend.sql` and click **Run**.
3. Copy the keys listed in `/.env.example` into Vercel's environment variables.

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
`tests/security-tests.sql` (68 checks) runs on a plain Postgres after `tests/local-supabase-stub.sql` and the migration.
