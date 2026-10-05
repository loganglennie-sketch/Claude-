-- ═══════════════════════════════════════════════════════════════════════
--  Timesheets – submit fix (run once in Supabase → SQL Editor, after the
--  earlier scripts)
--
--  Supabase refuses any DELETE without a WHERE clause ("DELETE requires a
--  WHERE clause"), even on the scratch table submit uses for its checks.
-- ═══════════════════════════════════════════════════════════════════════

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
  delete from pg_temp.checked_entries where true; -- Supabase refuses a DELETE with no WHERE

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

notify pgrst, 'reload schema';
select pg_terminate_backend(pid) from pg_stat_activity where usename = 'authenticator' and pid <> pg_backend_pid();
