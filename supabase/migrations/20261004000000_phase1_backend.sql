-- ═══════════════════════════════════════════════════════════════════════
--  Timesheets – Phase 1 database (run once in Supabase → SQL Editor)
--
--  Plain-English summary
--  • companies, users, timesheets, job_entries, signatures, audit_log
--  • Row-level security: a company only ever sees its own data; a worker
--    only their own timesheets. Apps can READ through the rules below but
--    every WRITE goes through a checked function in this file.
--  • Worker PINs are stored as bcrypt hashes and can never be read back.
--  • 5 wrong PINs → locked for 15 minutes. Every sign-in is logged.
--  • Nothing is ever deleted (leavers are deactivated).
-- ═══════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

-- Helpers live in a schema the public API does not expose.
create schema if not exists private;

-- ── Types ──────────────────────────────────────────────────────────────
create type public.user_role as enum ('super_admin', 'company_admin', 'worker');
create type public.timesheet_status as enum ('draft', 'submitted', 'approved');

-- ── Tables ─────────────────────────────────────────────────────────────
create table public.companies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(btrim(name)) between 1 and 120),
  slug          text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  -- Web addresses containing any of these words open as this company.
  host_keywords text[] not null default '{}',
  -- "times" = start & finish for every job; "hours-or-times" = may type hours.
  entry_mode    text not null default 'times' check (entry_mode in ('times', 'hours-or-times')),
  show_overtime boolean not null default false,
  payroll_email text,
  is_test       boolean not null default false,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table public.users (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid references public.companies (id),
  -- Link to Supabase Auth (set on first sign-in for workers, at creation for admins).
  auth_user_id     uuid unique,
  role             public.user_role not null,
  full_name        text not null check (length(btrim(full_name)) between 2 and 80),
  -- What people type to sign in: lower case, single spaces.
  name_key         text generated always as (lower(regexp_replace(btrim(full_name), '\s+', ' ', 'g'))) stored,
  email            text,
  employee_number  text,
  pin_hash         text,
  failed_attempts  integer not null default 0,
  locked_until     timestamptz,
  last_sign_in_at  timestamptz,
  active           boolean not null default true,
  deactivated_at   timestamptz,
  created_at       timestamptz not null default now(),
  created_by       uuid references public.users (id),
  constraint super_admin_has_no_company check ((role = 'super_admin') = (company_id is null)),
  constraint workers_have_pin check (role <> 'worker' or pin_hash is not null),
  constraint admins_have_email check (role = 'worker' or email is not null)
);
-- Two active people in one company can't share a sign-in name (leavers don't count).
create unique index users_unique_active_name on public.users (company_id, name_key) where active;
create unique index users_unique_email on public.users (lower(email)) where email is not null;

create table public.timesheets (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id),
  user_id       uuid not null references public.users (id),
  week_start    date not null check (extract(isodow from week_start) = 1),
  status        public.timesheet_status not null default 'draft',
  -- The week exactly as the worker filled it in (days, worked/day off, jobs).
  content       jsonb not null default '{"days": []}',
  reference     text unique,
  total_minutes integer,
  submitted_at  timestamptz,
  approved_at   timestamptz,
  approved_by   uuid references public.users (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, week_start)
);
create index timesheets_company_week on public.timesheets (company_id, week_start);

-- One row per job, written (and checked) when the timesheet is submitted.
create table public.job_entries (
  id            uuid primary key default gen_random_uuid(),
  timesheet_id  uuid not null references public.timesheets (id),
  company_id    uuid not null references public.companies (id),
  user_id       uuid not null references public.users (id),
  work_date     date not null,          -- the day the job STARTED
  position      integer not null,       -- order in the day (by start time)
  job_number    text not null check (length(job_number) between 1 and 20),
  start_time    time,                   -- null only for typed-hours entries
  finish_time   time,
  break_minutes integer not null default 0 check (break_minutes between 0 and 600),
  overnight     boolean not null default false,
  minutes       integer not null check (minutes > 0 and minutes <= 1440),
  created_at    timestamptz not null default now()
);
create index job_entries_timesheet on public.job_entries (timesheet_id);
create index job_entries_company_date on public.job_entries (company_id, work_date);

create table public.signatures (
  id            uuid primary key default gen_random_uuid(),
  timesheet_id  uuid not null unique references public.timesheets (id),
  company_id    uuid not null references public.companies (id),
  user_id       uuid not null references public.users (id),
  image_png     text not null check (image_png like 'data:image/png;base64,%' and length(image_png) <= 400000),
  declaration   text not null,
  signed_at     timestamptz not null default now()
);

create table public.audit_log (
  id             bigint generated always as identity primary key,
  company_id     uuid references public.companies (id),
  actor_user_id  uuid references public.users (id),
  target_user_id uuid references public.users (id),
  action         text not null,
  details        jsonb not null default '{}',
  ip             text,
  user_agent     text,
  created_at     timestamptz not null default now()
);
create index audit_log_company_time on public.audit_log (company_id, created_at desc);

-- ── Nothing is ever deleted; submitted work and the log never change ──
create function private.forbid_delete() returns trigger language plpgsql as $$
begin
  raise exception 'Records are never deleted (% table). Deactivate instead.', tg_table_name;
end $$;
create trigger no_delete before delete on public.companies   for each row execute function private.forbid_delete();
create trigger no_delete before delete on public.users       for each row execute function private.forbid_delete();
create trigger no_delete before delete on public.timesheets  for each row execute function private.forbid_delete();
create trigger no_delete before delete on public.job_entries for each row execute function private.forbid_delete();
create trigger no_delete before delete on public.signatures  for each row execute function private.forbid_delete();
create trigger no_delete before delete on public.audit_log   for each row execute function private.forbid_delete();

create function private.forbid_update() returns trigger language plpgsql as $$
begin
  raise exception '% records cannot be changed once written.', tg_table_name;
end $$;
create trigger no_update before update on public.job_entries for each row execute function private.forbid_update();
create trigger no_update before update on public.signatures  for each row execute function private.forbid_update();
create trigger no_update before update on public.audit_log   for each row execute function private.forbid_update();

create function private.protect_submitted_timesheet() returns trigger language plpgsql as $$
begin
  if old.status <> 'draft' and (new.content is distinct from old.content or new.user_id <> old.user_id
      or new.week_start <> old.week_start or new.reference is distinct from old.reference) then
    raise exception 'A submitted timesheet cannot be changed.';
  end if;
  if old.status = 'approved' and new.status <> 'approved' then
    raise exception 'An approved timesheet cannot be un-approved.';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger protect_submitted before update on public.timesheets for each row execute function private.protect_submitted_timesheet();

-- ── Who is calling? (used by the security rules) ──────────────────────
create function private.me() returns public.users
language sql stable security definer set search_path = '' as $$
  select u.* from public.users u where u.auth_user_id = auth.uid() and u.active limit 1;
$$;
create function private.my_user_id() returns uuid language sql stable security definer set search_path = '' as $$
  select (private.me()).id $$;
create function private.my_company_id() returns uuid language sql stable security definer set search_path = '' as $$
  select (private.me()).company_id $$;
create function private.my_role() returns public.user_role language sql stable security definer set search_path = '' as $$
  select (private.me()).role $$;
create function private.is_company_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((private.me()).role = 'company_admin', false) $$;
create function private.is_super_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((private.me()).role = 'super_admin', false) $$;

create function private.log(p_company uuid, p_actor uuid, p_target uuid, p_action text, p_details jsonb default '{}',
                            p_ip text default null, p_user_agent text default null) returns void
language sql security definer set search_path = '' as $$
  insert into public.audit_log (company_id, actor_user_id, target_user_id, action, details, ip, user_agent)
  values (p_company, p_actor, p_target, p_action, coalesce(p_details, '{}'), p_ip, left(p_user_agent, 300));
$$;

-- ── Row-level security: switched on for every table ───────────────────
alter table public.companies   enable row level security;
alter table public.users       enable row level security;
alter table public.timesheets  enable row level security;
alter table public.job_entries enable row level security;
alter table public.signatures  enable row level security;
alter table public.audit_log   enable row level security;

-- Start from nothing: signed-out visitors get no access at all, and
-- signed-in users can only read (writes go through the functions below).
revoke all on public.companies, public.users, public.timesheets, public.job_entries, public.signatures, public.audit_log from anon, authenticated;
grant select on public.companies, public.timesheets, public.job_entries, public.signatures, public.audit_log to authenticated;
-- PIN hashes are never readable through the app, not even by admins.
grant select (id, company_id, auth_user_id, role, full_name, name_key, email, employee_number, failed_attempts,
              locked_until, last_sign_in_at, active, deactivated_at, created_at, created_by) on public.users to authenticated;
grant usage on schema private to authenticated, service_role;

create policy "own company" on public.companies for select to authenticated
  using (id = private.my_company_id() or private.is_super_admin());

create policy "self, or admins see their company" on public.users for select to authenticated
  using (id = private.my_user_id()
         or (company_id = private.my_company_id() and private.is_company_admin()));

create policy "own timesheets, or admins see their company's" on public.timesheets for select to authenticated
  using (company_id = private.my_company_id() and (user_id = private.my_user_id() or private.is_company_admin()));

create policy "own job entries, or admins see their company's" on public.job_entries for select to authenticated
  using (company_id = private.my_company_id() and (user_id = private.my_user_id() or private.is_company_admin()));

create policy "own signatures, or admins see their company's" on public.signatures for select to authenticated
  using (company_id = private.my_company_id() and (user_id = private.my_user_id() or private.is_company_admin()));

create policy "admins read their company's log" on public.audit_log for select to authenticated
  using ((company_id = private.my_company_id() and private.is_company_admin()) or private.is_super_admin());

-- ── Small helpers ──────────────────────────────────────────────────────
create function private.normalise_name(p text) returns text language sql immutable as $$
  select lower(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g')) $$;

create function private.check_pin(p_pin text) returns void language plpgsql immutable as $$
begin
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    raise exception 'The PIN must be exactly 4 numbers.' using errcode = 'P0001';
  end if;
end $$;

create function private.hash_pin(p_pin text) returns text language sql volatile security definer set search_path = '' as $$
  select extensions.crypt(p_pin, extensions.gen_salt('bf', 10)) $$;

create function private.require_company_admin() returns public.users language plpgsql stable security definer set search_path = '' as $$
declare me public.users;
begin
  me := private.me();
  if me.id is null or me.role <> 'company_admin' then
    raise exception 'Only a company admin can do this.' using errcode = '42501';
  end if;
  return me;
end $$;

-- ═══ SIGN-IN (called by the app's server only, never by phones) ═══════
-- Name + PIN for workers. Locks after 5 wrong PINs for 15 minutes.
create function public.pin_sign_in(p_company_id uuid, p_name text, p_pin text, p_ip text default null, p_user_agent text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u public.users;
  max_attempts constant integer := 5;
  lock_for constant interval := interval '15 minutes';
begin
  select * into u from public.users
   where company_id = p_company_id and name_key = private.normalise_name(p_name) and active and role = 'worker'
   for update;

  if u.id is null then
    perform private.log(p_company_id, null, null, 'sign_in_failed', jsonb_build_object('reason', 'unknown_name', 'name_typed', left(p_name, 80)), p_ip, p_user_agent);
    return jsonb_build_object('ok', false, 'reason', 'wrong');
  end if;

  if u.locked_until is not null and u.locked_until > now() then
    perform private.log(p_company_id, null, u.id, 'sign_in_blocked_locked', jsonb_build_object('locked_until', u.locked_until), p_ip, p_user_agent);
    return jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', u.locked_until);
  end if;

  if p_pin ~ '^[0-9]{4}$' and extensions.crypt(p_pin, u.pin_hash) = u.pin_hash then
    update public.users set failed_attempts = 0, locked_until = null, last_sign_in_at = now() where id = u.id;
    perform private.log(p_company_id, u.id, u.id, 'sign_in_success', '{}', p_ip, p_user_agent);
    return jsonb_build_object('ok', true, 'user_id', u.id, 'auth_user_id', u.auth_user_id, 'full_name', u.full_name);
  end if;

  if u.failed_attempts + 1 >= max_attempts then
    update public.users set failed_attempts = 0, locked_until = now() + lock_for where id = u.id;
    perform private.log(p_company_id, null, u.id, 'account_locked', jsonb_build_object('minutes', 15), p_ip, p_user_agent);
    return jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', now() + lock_for);
  end if;

  update public.users set failed_attempts = u.failed_attempts + 1 where id = u.id;
  perform private.log(p_company_id, null, u.id, 'sign_in_failed', jsonb_build_object('reason', 'wrong_pin', 'attempt', u.failed_attempts + 1), p_ip, p_user_agent);
  return jsonb_build_object('ok', false, 'reason', 'wrong');
end $$;

-- After the server creates a worker's Supabase Auth account on first sign-in.
create function public.link_auth_user(p_user_id uuid, p_auth_user_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.users set auth_user_id = p_auth_user_id where id = p_user_id and auth_user_id is null;
$$;

-- Admin email sign-ins (handled by Supabase Auth) are logged here by the server.
create function public.log_admin_sign_in(p_email text, p_success boolean, p_ip text default null, p_user_agent text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare u public.users;
begin
  select * into u from public.users where lower(email) = lower(p_email) limit 1;
  perform private.log(u.company_id, case when p_success then u.id end, u.id,
                      case when p_success then 'admin_sign_in_success' else 'admin_sign_in_failed' end,
                      jsonb_build_object('email', left(p_email, 120)), p_ip, p_user_agent);
  if p_success and u.id is not null then update public.users set last_sign_in_at = now() where id = u.id; end if;
end $$;

-- ═══ COMPANY ADMIN ACTIONS ════════════════════════════════════════════
create function public.admin_add_worker(p_full_name text, p_pin text, p_employee_number text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare me public.users; new_id uuid; clean_name text := regexp_replace(btrim(p_full_name), '\s+', ' ', 'g');
begin
  me := private.require_company_admin();
  perform private.check_pin(p_pin);
  if length(clean_name) < 2 then raise exception 'Enter the worker''s full name.'; end if;
  if exists (select 1 from public.users where company_id = me.company_id and active and name_key = private.normalise_name(clean_name)) then
    raise exception 'Someone called "%" already works here. Add a middle name or a number, e.g. "% 2".', clean_name, clean_name
      using errcode = '23505';
  end if;
  insert into public.users (company_id, role, full_name, employee_number, pin_hash, created_by)
  values (me.company_id, 'worker', clean_name, nullif(btrim(p_employee_number), ''), private.hash_pin(p_pin), me.id)
  returning id into new_id;
  perform private.log(me.company_id, me.id, new_id, 'worker_added', jsonb_build_object('full_name', clean_name));
  return new_id;
end $$;

create function public.admin_reset_pin(p_user_id uuid, p_new_pin text) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.users;
begin
  me := private.require_company_admin();
  perform private.check_pin(p_new_pin);
  update public.users set pin_hash = private.hash_pin(p_new_pin), failed_attempts = 0, locked_until = null
   where id = p_user_id and company_id = me.company_id and role = 'worker';
  if not found then raise exception 'Worker not found.'; end if;
  perform private.log(me.company_id, me.id, p_user_id, 'pin_reset');
end $$;

create function public.admin_unlock(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.users;
begin
  me := private.require_company_admin();
  update public.users set failed_attempts = 0, locked_until = null where id = p_user_id and company_id = me.company_id;
  if not found then raise exception 'Worker not found.'; end if;
  perform private.log(me.company_id, me.id, p_user_id, 'account_unlocked');
end $$;

-- Leavers are deactivated, never deleted. Their timesheets are kept.
create function public.admin_set_worker_active(p_user_id uuid, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.users; target public.users;
begin
  me := private.require_company_admin();
  select * into target from public.users where id = p_user_id and company_id = me.company_id and role = 'worker';
  if target.id is null then raise exception 'Worker not found.'; end if;
  if p_active and exists (select 1 from public.users where company_id = me.company_id and active and name_key = target.name_key and id <> target.id) then
    raise exception 'Someone else with the name "%" is active. Rename one of them first.', target.full_name;
  end if;
  update public.users set active = p_active, deactivated_at = case when p_active then null else now() end where id = p_user_id;
  perform private.log(me.company_id, me.id, p_user_id, case when p_active then 'worker_reactivated' else 'worker_deactivated' end);
end $$;

create function public.admin_rename_worker(p_user_id uuid, p_full_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.users; clean_name text := regexp_replace(btrim(p_full_name), '\s+', ' ', 'g');
begin
  me := private.require_company_admin();
  if exists (select 1 from public.users where company_id = me.company_id and active and id <> p_user_id and name_key = private.normalise_name(clean_name)) then
    raise exception 'Someone called "%" already works here. Add a middle name or a number, e.g. "% 2".', clean_name, clean_name using errcode = '23505';
  end if;
  update public.users set full_name = clean_name where id = p_user_id and company_id = me.company_id and role = 'worker';
  if not found then raise exception 'Worker not found.'; end if;
  perform private.log(me.company_id, me.id, p_user_id, 'worker_renamed', jsonb_build_object('full_name', clean_name));
end $$;

create function public.admin_approve_timesheet(p_timesheet_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.users; t public.timesheets;
begin
  me := private.require_company_admin();
  select * into t from public.timesheets where id = p_timesheet_id and company_id = me.company_id for update;
  if t.id is null then raise exception 'Timesheet not found.'; end if;
  if t.status <> 'submitted' then raise exception 'Only submitted timesheets can be approved.'; end if;
  update public.timesheets set status = 'approved', approved_at = now(), approved_by = me.id where id = t.id;
  perform private.log(me.company_id, me.id, t.user_id, 'timesheet_approved', jsonb_build_object('timesheet_id', t.id, 'reference', t.reference));
end $$;

-- ═══ WORKER ACTIONS ═══════════════════════════════════════════════════
create function private.require_worker() returns public.users language plpgsql stable security definer set search_path = '' as $$
declare me public.users;
begin
  me := private.me();
  if me.id is null or me.role <> 'worker' then raise exception 'Please sign in again.' using errcode = '42501'; end if;
  return me;
end $$;

create function private.this_monday() returns date language sql stable as $$
  select (now() at time zone 'Europe/London')::date - (extract(isodow from (now() at time zone 'Europe/London'))::int - 1) $$;

-- Saves the week as it's being filled in (only while it's still a draft).
create function public.save_draft(p_week_start date, p_content jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.users; t public.timesheets;
begin
  me := private.require_worker();
  if extract(isodow from p_week_start) <> 1 then raise exception 'Weeks start on a Monday.'; end if;
  if p_week_start > private.this_monday() then raise exception 'You can''t fill in a future week.'; end if;
  if jsonb_typeof(p_content -> 'days') <> 'array' or pg_column_size(p_content) > 200000 then raise exception 'Timesheet data is not valid.'; end if;
  select * into t from public.timesheets where user_id = me.id and week_start = p_week_start for update;
  if t.id is null then
    insert into public.timesheets (company_id, user_id, week_start, content) values (me.company_id, me.id, p_week_start, p_content);
  elsif t.status = 'draft' then
    update public.timesheets set content = p_content where id = t.id;
  else
    raise exception 'This week has already been submitted and can''t be changed.';
  end if;
end $$;

-- "07:30" → minutes after midnight, or null if not a real 24-hour time.
create function private.clock_minutes(p text) returns integer language sql immutable as $$
  select case when p ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
              then split_part(p, ':', 1)::int * 60 + split_part(p, ':', 2)::int end $$;

-- Typed hours ("3", "3.5", "3,5", "3:30") → minutes, or null.
create function private.typed_minutes(p text) returns integer language sql immutable as $$
  select case
    when btrim(p) ~ '^[0-9]{1,2}(:|h)[0-5]?[0-9]$' then split_part(regexp_replace(btrim(p), 'h', ':'), ':', 1)::int * 60 + split_part(regexp_replace(btrim(p), 'h', ':'), ':', 2)::int
    when btrim(p) ~ '^[0-9]{0,2}([.,][0-9]{1,2})?$' and btrim(p) !~ '^[.,]?$' then round(replace(btrim(p), ',', '.')::numeric * 60)::int
  end $$;

-- Checks the week, writes the job entries and signature, and locks it.
-- The same rules as the phone, re-checked here so nothing can be skipped.
create function public.submit_timesheet(p_week_start date, p_signature_png text, p_declaration text, p_ip text default null, p_user_agent text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me public.users; co public.companies; t public.timesheets;
  day jsonb; job jsonb; d date; i int; k int; prev_overnight_end int := null; day_end int;
  s int; f int; dur int; mins int; brk int; ovn boolean; job_no text; mode text;
  day_total int; week_total int := 0; worked_days int := 0;
  e1 text; e2 text; ref text; tries int := 0;
  dname text;
begin
  me := private.require_worker();
  select * into co from public.companies where id = me.company_id;
  select * into t from public.timesheets where user_id = me.id and week_start = p_week_start for update;
  if t.id is null then raise exception 'Nothing to submit for this week yet.'; end if;
  if t.status <> 'draft' then raise exception 'This week has already been submitted.'; end if;
  if coalesce(p_declaration, '') = '' then raise exception 'Please tick the declaration.'; end if;
  if p_signature_png is null or p_signature_png not like 'data:image/png;base64,%' or length(p_signature_png) < 200 then
    raise exception 'Please sign before submitting.';
  end if;
  if jsonb_array_length(t.content -> 'days') <> 7 then raise exception 'Timesheet data is not valid.'; end if;

  create temporary table if not exists pg_temp.checked_entries (work_date date, position int, job_number text, start_time time,
    finish_time time, break_minutes int, overnight boolean, minutes int, span_start int, span_end int) on commit drop;
  delete from pg_temp.checked_entries;

  for i in 0..6 loop
    day := t.content -> 'days' -> i;
    d := p_week_start + i;
    if (day ->> 'date')::date <> d then raise exception 'Timesheet data is not valid.'; end if;
    dname := trim(to_char(d, 'FMDay'));
    if not coalesce((day ->> 'worked')::boolean, false) then prev_overnight_end := null; continue; end if;
    if jsonb_array_length(coalesce(day -> 'jobs', '[]')) = 0 then raise exception '%: add at least one job, or mark the day off.', dname; end if;
    worked_days := worked_days + 1; day_total := 0; day_end := null; k := 0;
    for job in select * from jsonb_array_elements(day -> 'jobs') loop
      k := k + 1;
      job_no := upper(btrim(coalesce(job ->> 'jobNumber', '')));
      if job_no = '' or length(job_no) > 20 then raise exception '%: every job needs a job number.', dname; end if;
      mode := coalesce(job ->> 'mode', 'times');
      if co.entry_mode = 'times' and mode <> 'times' then raise exception '%: every job needs a start and finish time.', dname; end if;
      brk := greatest(0, least(600, coalesce((job ->> 'breakMins')::int, 0)));
      if mode = 'times' then
        s := private.clock_minutes(job ->> 'start'); f := private.clock_minutes(job ->> 'finish');
        if s is null or f is null then raise exception '%: use the 24-hour clock for job %, like 07:30.', dname, job_no; end if;
        if s = f then raise exception '%: job % starts and finishes at the same time.', dname, job_no; end if;
        ovn := f < s;
        dur := case when ovn then f + 1440 - s else f - s end;
        if ovn and dur > 960 then raise exception '%: job % is over 16 hours through the night. Check the times.', dname, job_no; end if;
        mins := dur - brk;
        if mins <= 0 then raise exception '%: the break on job % is longer than the time worked.', dname, job_no; end if;
        insert into pg_temp.checked_entries values (d, k, job_no, make_time(s / 60, s % 60, 0), make_time(f / 60, f % 60, 0), brk, ovn, mins, s, s + dur);
      else
        mins := private.typed_minutes(job ->> 'hours');
        if mins is null or mins <= 0 then raise exception '%: add the hours for job %.', dname, job_no; end if;
        insert into pg_temp.checked_entries values (d, k, job_no, null, null, 0, false, mins, null, null);
      end if;
      day_total := day_total + mins;
    end loop;
    if day_total > 1440 then raise exception '%: that''s more than 24 hours in one day.', dname; end if;

    -- Overlaps within the day
    select a.job_number || ' (' || to_char(a.start_time, 'HH24:MI') || ')', b.job_number || ' (' || to_char(b.start_time, 'HH24:MI') || ')'
      into e1, e2
      from pg_temp.checked_entries a join pg_temp.checked_entries b
        on a.work_date = d and b.work_date = d and a.position < b.position and a.span_start is not null and b.span_start is not null
       and a.span_start < b.span_end and b.span_start < a.span_end
     limit 1;
    if e1 is not null then raise exception '%: jobs % and % overlap. Fix the times before submitting.', dname, e1, e2; end if;

    -- Can't start before last night's shift finished
    if prev_overnight_end is not null and exists (select 1 from pg_temp.checked_entries where work_date = d and span_start is not null and span_start < prev_overnight_end) then
      raise exception '%: starts before the previous day''s overnight job finished.', dname;
    end if;
    select max(span_end) - 1440 into prev_overnight_end from pg_temp.checked_entries where work_date = d and span_end > 1440;
    week_total := week_total + day_total;
  end loop;
  if worked_days = 0 then raise exception 'Mark at least one day as worked.'; end if;

  loop
    ref := 'TS-' || to_char(p_week_start, 'IYYY') || '-W' || to_char(p_week_start, 'IW') || '-' ||
           upper(substr(translate(encode(extensions.gen_random_bytes(6), 'base64'), '+/=0O1I', 'ABCXYZW'), 1, 4));
    exit when not exists (select 1 from public.timesheets where reference = ref);
    tries := tries + 1; if tries > 20 then raise exception 'Could not create a reference number. Please try again.'; end if;
  end loop;

  insert into public.job_entries (timesheet_id, company_id, user_id, work_date, position, job_number, start_time, finish_time, break_minutes, overnight, minutes)
  select t.id, me.company_id, me.id, work_date,
         row_number() over (partition by work_date order by span_start nulls last, position), job_number, start_time, finish_time, break_minutes, overnight, minutes
    from pg_temp.checked_entries;
  insert into public.signatures (timesheet_id, company_id, user_id, image_png, declaration)
  values (t.id, me.company_id, me.id, p_signature_png, p_declaration);
  update public.timesheets set status = 'submitted', submitted_at = now(), reference = ref, total_minutes = week_total where id = t.id;
  perform private.log(me.company_id, me.id, me.id, 'timesheet_submitted',
                      jsonb_build_object('timesheet_id', t.id, 'reference', ref, 'week_start', p_week_start, 'minutes', week_total), p_ip, p_user_agent);
  return jsonb_build_object('reference', ref, 'submitted_at', now(), 'total_minutes', week_total);
end $$;

-- ═══ SUPER ADMIN ══════════════════════════════════════════════════════
-- Every company with its active worker count (for billing). Names and
-- timesheets of other companies are NOT visible to the super admin.
create function public.super_admin_companies()
returns table (company_id uuid, name text, slug text, is_test boolean, active boolean,
               active_workers bigint, inactive_workers bigint, admins bigint, last_submission timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_super_admin() then raise exception 'Super admin only.' using errcode = '42501'; end if;
  return query
    select c.id, c.name, c.slug, c.is_test, c.active,
           count(u.id) filter (where u.role = 'worker' and u.active),
           count(u.id) filter (where u.role = 'worker' and not u.active),
           count(u.id) filter (where u.role = 'company_admin' and u.active),
           (select max(t.submitted_at) from public.timesheets t where t.company_id = c.id),
           c.created_at
      from public.companies c left join public.users u on u.company_id = c.id
     group by c.id order by c.name;
end $$;

-- ── Who may call what ─────────────────────────────────────────────────
-- Functions are callable by everyone by default in Postgres; lock them down.
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
-- Only the "who is calling?" checks are needed by the security rules.
grant execute on function private.me(), private.my_user_id(), private.my_company_id(), private.my_role(),
                          private.is_company_admin(), private.is_super_admin() to authenticated;
-- Signed-in people (rules inside each function decide what they may do):
grant execute on function public.save_draft(date, jsonb),
                          public.submit_timesheet(date, text, text, text, text),
                          public.admin_add_worker(text, text, text),
                          public.admin_reset_pin(uuid, text),
                          public.admin_unlock(uuid),
                          public.admin_set_worker_active(uuid, boolean),
                          public.admin_rename_worker(uuid, text),
                          public.admin_approve_timesheet(uuid),
                          public.super_admin_companies()
  to authenticated;
-- The app's server only (uses the secret key):
grant execute on function public.pin_sign_in(uuid, text, text, text, text),
                          public.link_auth_user(uuid, uuid),
                          public.log_admin_sign_in(text, boolean, text, text)
  to service_role;
grant all on all tables in schema public to service_role;
