-- Security and behaviour tests for the Phase 1 database.
-- Run on a local Postgres after local-supabase-stub.sql and the migration.
\set ON_ERROR_STOP 1
set client_min_messages = notice;

create function public.t_pass(label text) returns void language plpgsql as $$ begin raise notice 'PASS  %', label; end $$;
create function public.t_check(ok boolean, label text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'FAIL  %', label; end if; raise notice 'PASS  %', label; end $$;
create function public.t_error(sql text, pattern text, label text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then
    if sqlerrm ilike pattern then raise notice 'PASS  % (blocked: %)', label, sqlerrm; return; end if;
    raise exception 'FAIL  % – wrong error: %', label, sqlerrm;
  end;
  raise exception 'FAIL  % – it was allowed', label;
end $$;
grant execute on function public.t_pass(text), public.t_check(boolean, text), public.t_error(text, text, text) to anon, authenticated, service_role;

-- ── Set-up as the database owner ──────────────────────────────────────
insert into public.companies (id, name, slug, host_keywords, entry_mode, is_test) values
  ('11111111-0000-0000-0000-000000000001', 'Nicol of Skene', 'nicol', '{nicol}', 'times', true),
  ('22222222-0000-0000-0000-000000000002', 'Acme Builders', 'acme', '{acme}', 'hours-or-times', true);
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'gillian@nicol.test'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'boss@acme.test'),
  ('cccccccc-0000-0000-0000-00000000000c', 'logan@owner.test'),
  ('dddddddd-0000-0000-0000-00000000000d', null),
  ('eeeeeeee-0000-0000-0000-00000000000e', null);
insert into public.users (id, company_id, auth_user_id, role, full_name, email) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'company_admin', 'Gillian Admin', 'gillian@nicol.test'),
  ('b0000000-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-00000000000b', 'company_admin', 'Acme Boss', 'boss@acme.test'),
  ('c0000000-0000-0000-0000-000000000001', null, 'cccccccc-0000-0000-0000-00000000000c', 'super_admin', 'Logan Owner', 'logan@owner.test');

-- ── Company admins add workers ────────────────────────────────────────
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-00000000000a';
select public.t_check(public.admin_add_worker('Calum  Ross', '4821', 'E001') is not null, 'Nicol admin adds a worker (extra spaces tidied)');
select public.admin_add_worker('Fraser McLeod', '1357');
select public.admin_add_worker('John Smith', '2468');
select public.t_error($$select public.admin_add_worker('john smith', '1111')$$, '%already works here%"john smith 2"%', 'Duplicate name refused, suggests adding a number');
select public.t_check(public.admin_add_worker('John Smith 2', '1111') is not null, 'Duplicate made unique with a number');
select public.t_check(public.admin_add_worker('John Andrew Smith', '2222') is not null, 'Duplicate made unique with a middle name');
select public.t_error($$select public.admin_add_worker('Bad Pin', '12345')$$, '%exactly 4 numbers%', 'PIN must be 4 numbers');
select public.t_error($$select public.admin_add_worker('Bad Pin', 'abcd')$$, '%exactly 4 numbers%', 'PIN must be numbers only');
select public.t_check((select count(*) from public.users) = 6, 'Nicol admin sees own company only (6 people)');
select public.t_check(not exists (select 1 from public.users where company_id = '22222222-0000-0000-0000-000000000002'), 'Nicol admin cannot see Acme people');
select public.t_error($$select pin_hash from public.users$$, '%permission denied%', 'PIN hashes are unreadable, even for admins');
reset role;

set role authenticated; set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-00000000000b';
select public.admin_add_worker('Acme Worker', '9999');
select public.t_error($$select public.admin_reset_pin((select id from public.users where full_name = 'Calum Ross'), '0000')$$, '%', 'Acme admin cannot touch Nicol worker (cannot even see them)');
reset role;
select public.t_check((select pin_hash like '$2a$%' and pin_hash not like '%4821%' from public.users where full_name = 'Calum Ross'), 'PIN stored as a bcrypt hash, not plain text');

-- ── Signed-out visitors get nothing ──────────────────────────────────
set role anon; reset request.jwt.claim.sub;
select public.t_error($$select * from public.timesheets$$, '%permission denied%', 'Signed-out: no timesheets');
select public.t_error($$select * from public.users$$, '%permission denied%', 'Signed-out: no users');
select public.t_error($$select public.pin_sign_in('11111111-0000-0000-0000-000000000001', 'Calum Ross', '4821')$$, '%permission denied%', 'Signed-out: cannot call PIN check directly');
reset role;
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-00000000000a';
select public.t_error($$select public.pin_sign_in('11111111-0000-0000-0000-000000000001', 'Calum Ross', '4821')$$, '%permission denied%', 'Signed-in users cannot call PIN check directly either (server only)');
reset role;

-- ── Name + PIN sign-in with lock-out (as the app server) ─────────────
set role service_role;
select public.t_check((public.pin_sign_in('11111111-0000-0000-0000-000000000001', 'calum ross', '4821') ->> 'ok')::boolean, 'Correct name (any capitals) + PIN signs in');
select public.t_check((public.pin_sign_in('11111111-0000-0000-0000-000000000001', 'Calum Ross', '4821') ->> 'auth_user_id') is null, 'First sign-in: no auth account yet (server will create one)');
select public.link_auth_user((select id from public.users where full_name = 'Calum Ross'), 'dddddddd-0000-0000-0000-00000000000d');
select public.link_auth_user((select id from public.users where full_name = 'Fraser McLeod'), 'eeeeeeee-0000-0000-0000-00000000000e');
select public.t_check(public.pin_sign_in('22222222-0000-0000-0000-000000000002', 'Calum Ross', '4821') ->> 'reason' = 'wrong', 'Right PIN at the wrong company fails');
select public.t_check(public.pin_sign_in('11111111-0000-0000-0000-000000000001', 'Nobody Here', '4821') ->> 'reason' = 'wrong', 'Unknown name gives the same message as a wrong PIN');
select public.pin_sign_in('11111111-0000-0000-0000-000000000001', 'Calum Ross', '0001');
select public.pin_sign_in('11111111-0000-0000-0000-000000000001', 'Calum Ross', '0002');
select public.pin_sign_in('11111111-0000-0000-0000-000000000001', 'Calum Ross', '0003');
select public.t_check(public.pin_sign_in('11111111-0000-0000-0000-000000000001', 'Calum Ross', '0004') ->> 'reason' = 'wrong', '4th wrong PIN: still just "wrong"');
select public.t_check(public.pin_sign_in('11111111-0000-0000-0000-000000000001', 'Calum Ross', '0005') ->> 'reason' = 'locked', '5th wrong PIN: account locked');
select public.t_check(public.pin_sign_in('11111111-0000-0000-0000-000000000001', 'Calum Ross', '4821') ->> 'reason' = 'locked', 'Even the right PIN is refused while locked');
reset role;
select public.t_check((select locked_until between now() + interval '14 minutes' and now() + interval '16 minutes' from public.users where full_name = 'Calum Ross'), 'Lock lasts 15 minutes');
update public.users set locked_until = now() - interval '1 second' where full_name = 'Calum Ross';  -- pretend 15 minutes passed
set role service_role;
select public.t_check((public.pin_sign_in('11111111-0000-0000-0000-000000000001', 'Calum Ross', '4821') ->> 'ok')::boolean, 'After 15 minutes the right PIN works again');
reset role;
select public.t_check((select count(*) from public.audit_log where action like 'sign_in%' or action = 'account_locked') >= 10, 'Every sign-in attempt was logged');
select public.t_check((select count(*) from public.audit_log where action = 'account_locked') = 1, 'Lock-out was logged');

-- ── Worker: drafts, submitting, and seeing only their own ────────────
set role authenticated; set request.jwt.claim.sub = 'dddddddd-0000-0000-0000-00000000000d';   -- Calum
select public.t_error($$insert into public.timesheets (company_id, user_id, week_start) values ('11111111-0000-0000-0000-000000000001', (select id from public.users limit 1), '2026-09-21')$$, '%permission denied%', 'Worker cannot write tables directly');
select public.t_error($$update public.users set role = 'company_admin'$$, '%permission denied%', 'Worker cannot make themselves an admin');
select public.t_error($$select public.admin_add_worker('Sneaky', '1234')$$, '%Only a company admin%', 'Worker cannot add workers');
select public.t_check((select count(*) from public.users) = 1, 'Worker sees only their own user record');
-- A realistic week: split day with a gap, overnight shift, Saturday job
select public.save_draft('2026-09-21', '{"weekStart":"2026-09-21","days":[
 {"date":"2026-09-21","worked":true,"jobs":[{"jobNumber":"3105","mode":"times","start":"07:30","finish":"11:30","breakMins":0},{"jobNumber":"3118","mode":"times","start":"12:15","finish":"16:45","breakMins":30}]},
 {"date":"2026-09-22","worked":true,"jobs":[{"jobNumber":"3131","mode":"times","start":"22:00","finish":"06:00","breakMins":30}]},
 {"date":"2026-09-23","worked":true,"jobs":[{"jobNumber":"3124","mode":"times","start":"07:00","finish":"15:30","breakMins":30}]},
 {"date":"2026-09-24","worked":false,"jobs":[]},
 {"date":"2026-09-25","worked":true,"jobs":[{"jobNumber":"3112","mode":"times","start":"07:30","finish":"16:30","breakMins":30}]},
 {"date":"2026-09-26","worked":true,"jobs":[{"jobNumber":"3118","mode":"times","start":"08:00","finish":"12:30","breakMins":0}]},
 {"date":"2026-09-27","worked":false,"jobs":[]}]}');
select public.t_error($$select public.submit_timesheet('2026-09-21', 'not a picture', 'I confirm')$$, '%sign before submitting%', 'Cannot submit without a signature');
select public.t_check((public.submit_timesheet('2026-09-21', 'data:image/png;base64,' || repeat('A', 300), 'I confirm these hours are a true and accurate record') ->> 'total_minutes')::int = 8*60 + 7*60+30 + 8*60 + 8*60+30 + 4*60+30, 'Valid week submits with the right total (37h)');
select public.t_check((select count(*) from public.job_entries) = 6, '6 job entries written');
select public.t_check((select overnight and minutes = 450 and work_date = '2026-09-22' from public.job_entries where job_number = '3131'), 'Night shift: overnight, 7h30, on the day it started');
select public.t_check((select position from public.job_entries where job_number = '3118' and work_date = '2026-09-21') = 2, 'Jobs stored in time order');
select public.t_check((select reference ~ '^TS-2026-W39-[A-Z0-9]{4}$' and status = 'submitted' from public.timesheets), 'Reference number created');
select public.t_error($$select public.submit_timesheet('2026-09-21', 'data:image/png;base64,' || repeat('A', 300), 'x')$$, '%already been submitted%', 'Cannot submit twice');
select public.t_error($$select public.save_draft('2026-09-21', '{"days":[]}')$$, '%already been submitted%', 'Submitted week cannot be edited');
-- Mistakes the database refuses even if the phone were tampered with
select public.save_draft('2026-09-14', '{"days":[{"date":"2026-09-14","worked":true,"jobs":[{"jobNumber":"3105","mode":"times","start":"09:00","finish":"12:00","breakMins":0},{"jobNumber":"3124","mode":"times","start":"11:00","finish":"14:00","breakMins":0}]},{"date":"2026-09-15","worked":false},{"date":"2026-09-16","worked":false},{"date":"2026-09-17","worked":false},{"date":"2026-09-18","worked":false},{"date":"2026-09-19","worked":false},{"date":"2026-09-20","worked":false}]}');
select public.t_error($$select public.submit_timesheet('2026-09-14', 'data:image/png;base64,' || repeat('A', 300), 'x')$$, '%overlap%', 'Overlapping jobs refused');
select public.save_draft('2026-09-14', '{"days":[{"date":"2026-09-14","worked":true,"jobs":[{"jobNumber":"3105","mode":"times","start":"22:00","finish":"06:00","breakMins":0}]},{"date":"2026-09-15","worked":true,"jobs":[{"jobNumber":"3124","mode":"times","start":"05:00","finish":"09:00","breakMins":0}]},{"date":"2026-09-16","worked":false},{"date":"2026-09-17","worked":false},{"date":"2026-09-18","worked":false},{"date":"2026-09-19","worked":false},{"date":"2026-09-20","worked":false}]}');
select public.t_error($$select public.submit_timesheet('2026-09-14', 'data:image/png;base64,' || repeat('A', 300), 'x')$$, '%previous day''s overnight%', 'Starting before last night''s shift ended refused');
select public.save_draft('2026-09-14', '{"days":[{"date":"2026-09-14","worked":true,"jobs":[{"jobNumber":" ","mode":"times","start":"07:00","finish":"09:00","breakMins":0}]},{"date":"2026-09-15","worked":false},{"date":"2026-09-16","worked":false},{"date":"2026-09-17","worked":false},{"date":"2026-09-18","worked":false},{"date":"2026-09-19","worked":false},{"date":"2026-09-20","worked":false}]}');
select public.t_error($$select public.submit_timesheet('2026-09-14', 'data:image/png;base64,' || repeat('A', 300), 'x')$$, '%job number%', 'Missing job number refused');
select public.save_draft('2026-09-14', '{"days":[{"date":"2026-09-14","worked":true,"jobs":[{"jobNumber":"3105","mode":"hours","hours":"8"}]},{"date":"2026-09-15","worked":false},{"date":"2026-09-16","worked":false},{"date":"2026-09-17","worked":false},{"date":"2026-09-18","worked":false},{"date":"2026-09-19","worked":false},{"date":"2026-09-20","worked":false}]}');
select public.t_error($$select public.submit_timesheet('2026-09-14', 'data:image/png;base64,' || repeat('A', 300), 'x')$$, '%start and finish%', 'Typed hours refused for a times-only company');
select public.save_draft('2026-09-14', '{"days":[{"date":"2026-09-14","worked":true,"jobs":[{"jobNumber":"3105","mode":"times","start":"25:00","finish":"09:00","breakMins":0}]},{"date":"2026-09-15","worked":false},{"date":"2026-09-16","worked":false},{"date":"2026-09-17","worked":false},{"date":"2026-09-18","worked":false},{"date":"2026-09-19","worked":false},{"date":"2026-09-20","worked":false}]}');
select public.t_error($$select public.submit_timesheet('2026-09-14', 'data:image/png;base64,' || repeat('A', 300), 'x')$$, '%24-hour clock%', 'Impossible time refused');
select public.t_error($$select public.save_draft('2099-01-05', '{"days":[]}')$$, '%future week%', 'Future weeks refused');
select public.t_error($$select public.save_draft('2026-09-23', '{"days":[]}')$$, '%Monday%', 'Weeks must start on a Monday');
select public.t_error($$select public.admin_approve_timesheet((select id from public.timesheets where status = 'submitted'))$$, '%Only a company admin%', 'Worker cannot approve their own timesheet');
reset role;

set role authenticated; set request.jwt.claim.sub = 'eeeeeeee-0000-0000-0000-00000000000e';   -- Fraser
select public.t_check(not exists (select 1 from public.timesheets), 'Another worker cannot see Calum''s timesheets');
select public.t_check(not exists (select 1 from public.job_entries) and not exists (select 1 from public.signatures), '...nor his job entries or signature');
reset role;

-- ── Office ───────────────────────────────────────────────────────────
set role authenticated; set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-00000000000b';   -- Acme admin
select public.t_check(not exists (select 1 from public.timesheets) and not exists (select 1 from public.job_entries), 'Other company''s admin cannot see Nicol timesheets');
select public.t_error($$select public.admin_approve_timesheet((select id from public.timesheets limit 1))$$, '%not found%', 'Other company''s admin cannot approve');
reset role;
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-00000000000a';   -- Nicol admin
select public.t_check((select count(*) from public.job_entries) = 6 and (select count(*) from public.signatures) = 1, 'Nicol admin sees the submitted job entries and signature');
select public.admin_approve_timesheet((select id from public.timesheets where status = 'submitted'));
select public.t_check((select status = 'approved' and approved_by is not null from public.timesheets where status <> 'draft'), 'Nicol admin approves');
select public.t_check((select count(*) from public.audit_log where action in ('timesheet_submitted','timesheet_approved')) = 2, 'Submit and approve were logged');
-- Leavers
select public.admin_set_worker_active((select id from public.users where full_name = 'John Smith'), false);
select public.t_check(public.admin_add_worker('John Smith', '3333') is not null, 'After a leaver is deactivated, a new starter can use the same name');
select public.t_error($$select public.admin_set_worker_active((select id from public.users where full_name = 'John Smith' and not active), true)$$, '%Rename one of them%', 'Cannot reactivate if the name is now taken');
select public.admin_set_worker_active((select id from public.users where full_name = 'Fraser McLeod'), false);
select public.admin_reset_pin((select id from public.users where full_name = 'Calum Ross'), '7777');
select public.t_error($$delete from public.users$$, '%permission denied%', 'Admins cannot delete anyone');
reset role;
set role service_role;
select public.t_check(public.pin_sign_in('11111111-0000-0000-0000-000000000001', 'Fraser McLeod', '1357') ->> 'reason' = 'wrong', 'Deactivated worker cannot sign in');
select public.t_check((public.pin_sign_in('11111111-0000-0000-0000-000000000001', 'Calum Ross', '7777') ->> 'ok')::boolean, 'Reset PIN works');
reset role;
set role authenticated; set request.jwt.claim.sub = 'eeeeeeee-0000-0000-0000-00000000000e';   -- Fraser, still holding an old session
select public.t_check(not exists (select 1 from public.users) and not exists (select 1 from public.companies), 'Deactivated worker''s old session sees nothing');
reset role;

-- ── Nothing deleted, history unchangeable ────────────────────────────
select public.t_error($$delete from public.timesheets$$, '%never deleted%', 'Even the database owner cannot delete timesheets');
select public.t_error($$update public.audit_log set action = 'x'$$, '%cannot be changed%', 'Audit log cannot be edited');
select public.t_error($$update public.job_entries set minutes = 1$$, '%cannot be changed%', 'Submitted job entries cannot be edited');
select public.t_error($$update public.timesheets set content = '{"days":[]}' where status = 'approved'$$, '%cannot be changed%', 'Approved timesheet content cannot be edited');

-- ── Super admin (billing view) ───────────────────────────────────────
set role authenticated; set request.jwt.claim.sub = 'cccccccc-0000-0000-0000-00000000000c';
select public.t_check((select active_workers from public.super_admin_companies() where slug = 'nicol') = 4, 'Super admin sees Nicol has 4 active workers (2 leavers not counted)');
select public.t_check((select inactive_workers from public.super_admin_companies() where slug = 'nicol') = 2, '...and 2 deactivated');
select public.t_check((select count(*) from public.companies) = 2, 'Super admin sees all companies');
select public.t_check(not exists (select 1 from public.timesheets) and not exists (select 1 from public.users where role = 'worker'), 'Super admin cannot see workers'' names or timesheets');
reset role;
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-00000000000a';
select public.t_error($$select * from public.super_admin_companies()$$, '%Super admin only%', 'Company admin cannot see the billing view');
reset role;
select public.t_pass('ALL TESTS FINISHED');
