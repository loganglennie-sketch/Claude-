-- ═══════════════════════════════════════════════════════════════════════
--  Timesheets – sturdier "who is signed in?" checks (run once in Supabase →
--  SQL Editor, after the earlier scripts)
--
--  Fixes: saving a timesheet failed with 'null value in column "company_id"'
--  for workers added after the PIN update. On some PostgreSQL 17 versions a
--  whole user record handed from one database function to another can arrive
--  empty after a column is added to the users table. The checks now pass only
--  the user's id, and each function reads the user record itself.
--  Same rules and security as before.
-- ═══════════════════════════════════════════════════════════════════════

-- Who is calling? (used by the security rules): read straight from the table.
create or replace function private.my_user_id() returns uuid language sql stable security definer set search_path = '' as $$
  select u.id from public.users u where u.auth_user_id = auth.uid() and u.active limit 1 $$;
create or replace function private.my_company_id() returns uuid language sql stable security definer set search_path = '' as $$
  select u.company_id from public.users u where u.auth_user_id = auth.uid() and u.active limit 1 $$;
create or replace function private.my_role() returns public.user_role language sql stable security definer set search_path = '' as $$
  select u.role from public.users u where u.auth_user_id = auth.uid() and u.active limit 1 $$;
create or replace function private.is_company_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.users u where u.auth_user_id = auth.uid() and u.active and u.role = 'company_admin') $$;
create or replace function private.is_super_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.users u where u.auth_user_id = auth.uid() and u.active and u.role = 'super_admin') $$;

-- The signed-in worker's / company admin's id, or an error.
create function private.require_worker_id() returns uuid language plpgsql stable security definer set search_path = '' as $$
declare uid uuid;
begin
  select u.id into uid from public.users u where u.auth_user_id = auth.uid() and u.active and u.role = 'worker' limit 1;
  if uid is null then raise exception 'Please sign in again.' using errcode = '42501'; end if;
  return uid;
end $$;
create function private.require_company_admin_id() returns uuid language plpgsql stable security definer set search_path = '' as $$
declare uid uuid;
begin
  select u.id into uid from public.users u where u.auth_user_id = auth.uid() and u.active and u.role = 'company_admin' limit 1;
  if uid is null then raise exception 'Only a company admin can do this.' using errcode = '42501'; end if;
  return uid;
end $$;
revoke execute on function private.require_worker_id(), private.require_company_admin_id() from public, anon, authenticated;

-- Every function that needs the signed-in person now reads them itself.
create or replace function public.save_draft(p_week_start date, p_content jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.users; t public.timesheets;
begin
  select * into me from public.users where id = private.require_worker_id();
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

create or replace function public.submit_timesheet(p_week_start date, p_signature_png text, p_declaration text, p_ip text default null, p_user_agent text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me public.users; co public.companies; t public.timesheets;
  day jsonb; job jsonb; d date; i int; k int; prev_overnight_end int := null; day_end int;
  s int; f int; dur int; mins int; brk int; ovn boolean; job_no text; mode text;
  day_total int; week_total int := 0; worked_days int := 0; absent_days int := 0; travel int; absence text; e jsonb;
  e1 text; e2 text; ref text; tries int := 0;
  dname text;
begin
  select * into me from public.users where id = private.require_worker_id();
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
    finish_time time, break_minutes int, overnight boolean, minutes int, span_start int, span_end int, travel_minutes int) on commit drop;
  delete from pg_temp.checked_entries;

  for i in 0..6 loop
    day := t.content -> 'days' -> i;
    d := p_week_start + i;
    if (day ->> 'date')::date <> d then raise exception 'Timesheet data is not valid.'; end if;
    dname := trim(to_char(d, 'FMDay'));
    if not coalesce((day ->> 'worked')::boolean, false) then
      absence := day ->> 'absence';
      if absence is not null and absence not in ('holiday', 'sick') then raise exception 'Timesheet data is not valid.'; end if;
      if absence is not null then absent_days := absent_days + 1; end if;
      prev_overnight_end := null; continue;
    end if;
    if jsonb_array_length(coalesce(day -> 'jobs', '[]')) = 0 then raise exception '%: add at least one job, or mark the day off.', dname; end if;
    worked_days := worked_days + 1; day_total := 0; day_end := null; k := 0;
    for job in select * from jsonb_array_elements(day -> 'jobs') loop
      k := k + 1;
      job_no := upper(btrim(coalesce(job ->> 'jobNumber', '')));
      if job_no = '' or length(job_no) > 20 then raise exception '%: every job needs a job number.', dname; end if;
      mode := coalesce(job ->> 'mode', 'times');
      if co.entry_mode = 'times' and mode <> 'times' then raise exception '%: every job needs a start and finish time.', dname; end if;
      brk := greatest(0, least(600, coalesce((job ->> 'breakMins')::int, 0)));
      travel := 0;
      if btrim(coalesce(job ->> 'travel', '')) <> '' then
        travel := private.typed_minutes(job ->> 'travel');
        if travel is null or travel < 0 or travel > 720 then raise exception '%: travel time for job % should be in hours, like 1 or 1.5.', dname, job_no; end if;
      end if;
      if mode = 'times' then
        s := private.clock_minutes(job ->> 'start'); f := private.clock_minutes(job ->> 'finish');
        if s is null or f is null then raise exception '%: use the 24-hour clock for job %, like 07:30.', dname, job_no; end if;
        if s = f then raise exception '%: job % starts and finishes at the same time.', dname, job_no; end if;
        ovn := f < s;
        dur := case when ovn then f + 1440 - s else f - s end;
        if ovn and dur > 960 then raise exception '%: job % is over 16 hours through the night. Check the times.', dname, job_no; end if;
        mins := dur - brk;
        if mins <= 0 then raise exception '%: the break on job % is longer than the time worked.', dname, job_no; end if;
        insert into pg_temp.checked_entries values (d, k, job_no, make_time(s / 60, s % 60, 0), make_time(f / 60, f % 60, 0), brk, ovn, mins, s, s + dur, travel);
      else
        mins := private.typed_minutes(job ->> 'hours');
        if mins is null or mins <= 0 then raise exception '%: add the hours for job %.', dname, job_no; end if;
        insert into pg_temp.checked_entries values (d, k, job_no, null, null, 0, false, mins, null, null, travel);
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
  if worked_days = 0 and absent_days = 0 then raise exception 'Mark at least one day as worked, holiday or sick.'; end if;

  -- Expenses (pounds) and notes.
  if t.content ? 'expenses' then
    if jsonb_typeof(t.content -> 'expenses') <> 'array' or jsonb_array_length(t.content -> 'expenses') > 30 then raise exception 'Timesheet data is not valid.'; end if;
    for e in select * from jsonb_array_elements(t.content -> 'expenses') loop
      if btrim(coalesce(e ->> 'amount', '') || coalesce(e ->> 'description', '') || coalesce(e ->> 'jobNumber', '')) = '' then continue; end if;
      if coalesce(e ->> 'amount', '') !~ '^\s*(£)?\s*[0-9]{1,5}(\.[0-9]{1,2})?\s*$' or length(coalesce(e ->> 'description', '')) > 80
         or length(coalesce(e ->> 'jobNumber', '')) > 20 then
        raise exception 'Check your expenses: enter each amount in pounds, like 12.50.';
      end if;
    end loop;
  end if;
  if length(coalesce(t.content ->> 'notes', '')) > 2000 then raise exception 'Other details is too long.'; end if;

  loop
    ref := 'TS-' || to_char(p_week_start, 'IYYY') || '-W' || to_char(p_week_start, 'IW') || '-' ||
           upper(substr(translate(encode(extensions.gen_random_bytes(6), 'base64'), '+/=0O1I', 'ABCXYZW'), 1, 4));
    exit when not exists (select 1 from public.timesheets where reference = ref);
    tries := tries + 1; if tries > 20 then raise exception 'Could not create a reference number. Please try again.'; end if;
  end loop;

  insert into public.job_entries (timesheet_id, company_id, user_id, work_date, position, job_number, start_time, finish_time, break_minutes, overnight, minutes, travel_minutes)
  select t.id, me.company_id, me.id, work_date,
         row_number() over (partition by work_date order by span_start nulls last, position), job_number, start_time, finish_time, break_minutes, overnight, minutes, travel_minutes
    from pg_temp.checked_entries;
  insert into public.signatures (timesheet_id, company_id, user_id, image_png, declaration)
  values (t.id, me.company_id, me.id, p_signature_png, p_declaration);
  update public.timesheets set status = 'submitted', submitted_at = now(), reference = ref, total_minutes = week_total where id = t.id;
  perform private.log(me.company_id, me.id, me.id, 'timesheet_submitted',
                      jsonb_build_object('timesheet_id', t.id, 'reference', ref, 'week_start', p_week_start, 'minutes', week_total), p_ip, p_user_agent);
  return jsonb_build_object('reference', ref, 'submitted_at', now(), 'total_minutes', week_total);
end $$;

create or replace function public.worker_change_pin(p_current_pin text, p_new_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.users;
begin
  select * into me from public.users where id = private.require_worker_id();
  select * into me from public.users where id = me.id for update;
  if me.locked_until is not null and me.locked_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'locked');
  end if;
  if coalesce(p_current_pin, '') !~ '^[0-9]{4}$' or extensions.crypt(p_current_pin, me.pin_hash) <> me.pin_hash then
    if me.failed_attempts + 1 >= 5 then
      update public.users set failed_attempts = 0, locked_until = now() + interval '15 minutes' where id = me.id;
      perform private.log(me.company_id, me.id, me.id, 'account_locked', jsonb_build_object('minutes', 15, 'while', 'changing_pin'));
      return jsonb_build_object('ok', false, 'reason', 'locked');
    end if;
    update public.users set failed_attempts = me.failed_attempts + 1 where id = me.id;
    perform private.log(me.company_id, me.id, me.id, 'pin_change_failed', jsonb_build_object('reason', 'wrong_current_pin'));
    return jsonb_build_object('ok', false, 'reason', 'wrong_current');
  end if;
  if coalesce(p_new_pin, '') !~ '^[0-9]{4}$' then return jsonb_build_object('ok', false, 'reason', 'not_four_numbers'); end if;
  if p_new_pin = p_current_pin then return jsonb_build_object('ok', false, 'reason', 'same_as_current'); end if;
  if private.weak_pin(p_new_pin) then return jsonb_build_object('ok', false, 'reason', 'too_easy'); end if;
  update public.users set pin_hash = private.hash_pin(p_new_pin), pin_must_change = false, failed_attempts = 0, locked_until = null where id = me.id;
  perform private.log(me.company_id, me.id, me.id, 'pin_changed');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_add_worker(p_full_name text, p_pin text, p_employee_number text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare me public.users; new_id uuid; clean_name text := regexp_replace(btrim(p_full_name), '\s+', ' ', 'g');
begin
  select * into me from public.users where id = private.require_company_admin_id();
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

create or replace function public.admin_reset_pin(p_user_id uuid, p_new_pin text) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.users;
begin
  select * into me from public.users where id = private.require_company_admin_id();
  perform private.check_pin(p_new_pin);
  update public.users set pin_hash = private.hash_pin(p_new_pin), pin_must_change = true, failed_attempts = 0, locked_until = null
   where id = p_user_id and company_id = me.company_id and role = 'worker';
  if not found then raise exception 'Worker not found.'; end if;
  perform private.log(me.company_id, me.id, p_user_id, 'pin_reset');
end $$;

create or replace function public.admin_unlock(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.users;
begin
  select * into me from public.users where id = private.require_company_admin_id();
  update public.users set failed_attempts = 0, locked_until = null where id = p_user_id and company_id = me.company_id;
  if not found then raise exception 'Worker not found.'; end if;
  perform private.log(me.company_id, me.id, p_user_id, 'account_unlocked');
end $$;

create or replace function public.admin_set_worker_active(p_user_id uuid, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.users; target public.users;
begin
  select * into me from public.users where id = private.require_company_admin_id();
  select * into target from public.users where id = p_user_id and company_id = me.company_id and role = 'worker';
  if target.id is null then raise exception 'Worker not found.'; end if;
  if p_active and exists (select 1 from public.users where company_id = me.company_id and active and name_key = target.name_key and id <> target.id) then
    raise exception 'Someone else with the name "%" is active. Rename one of them first.', target.full_name;
  end if;
  update public.users set active = p_active, deactivated_at = case when p_active then null else now() end where id = p_user_id;
  perform private.log(me.company_id, me.id, p_user_id, case when p_active then 'worker_reactivated' else 'worker_deactivated' end);
end $$;

create or replace function public.admin_rename_worker(p_user_id uuid, p_full_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.users; clean_name text := regexp_replace(btrim(p_full_name), '\s+', ' ', 'g');
begin
  select * into me from public.users where id = private.require_company_admin_id();
  if exists (select 1 from public.users where company_id = me.company_id and active and id <> p_user_id and name_key = private.normalise_name(clean_name)) then
    raise exception 'Someone called "%" already works here. Add a middle name or a number, e.g. "% 2".', clean_name, clean_name using errcode = '23505';
  end if;
  update public.users set full_name = clean_name where id = p_user_id and company_id = me.company_id and role = 'worker';
  if not found then raise exception 'Worker not found.'; end if;
  perform private.log(me.company_id, me.id, p_user_id, 'worker_renamed', jsonb_build_object('full_name', clean_name));
end $$;

create or replace function public.admin_approve_timesheet(p_timesheet_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.users; t public.timesheets;
begin
  select * into me from public.users where id = private.require_company_admin_id();
  select * into t from public.timesheets where id = p_timesheet_id and company_id = me.company_id for update;
  if t.id is null then raise exception 'Timesheet not found.'; end if;
  if t.status <> 'submitted' then raise exception 'Only submitted timesheets can be approved.'; end if;
  update public.timesheets set status = 'approved', approved_at = now(), approved_by = me.id where id = t.id;
  perform private.log(me.company_id, me.id, t.user_id, 'timesheet_approved', jsonb_build_object('timesheet_id', t.id, 'reference', t.reference));
end $$;

-- Old helpers that handed the whole record over are no longer used.
drop function private.require_worker();
drop function private.require_company_admin();

-- Permissions unchanged (replacing a function keeps them); stated again to be safe.
revoke execute on function public.save_draft(date, jsonb), public.submit_timesheet(date, text, text, text, text),
  public.worker_change_pin(text, text), public.admin_add_worker(text, text, text), public.admin_reset_pin(uuid, text),
  public.admin_unlock(uuid), public.admin_set_worker_active(uuid, boolean), public.admin_rename_worker(uuid, text),
  public.admin_approve_timesheet(uuid) from public, anon;
grant execute on function public.save_draft(date, jsonb), public.submit_timesheet(date, text, text, text, text),
  public.worker_change_pin(text, text), public.admin_add_worker(text, text, text), public.admin_reset_pin(uuid, text),
  public.admin_unlock(uuid), public.admin_set_worker_active(uuid, boolean), public.admin_rename_worker(uuid, text),
  public.admin_approve_timesheet(uuid) to authenticated;

notify pgrst, 'reload schema';
-- Make the app reconnect so it uses the new versions straight away.
select pg_terminate_backend(pid) from pg_stat_activity where usename = 'authenticator' and pid <> pg_backend_pid();
