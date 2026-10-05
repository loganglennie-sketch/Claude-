-- Tests for the paper-form fields (migration 20261006000000_nicol_form_fields.sql).
-- Run after security-tests.sql (uses its people and helper functions).
set role authenticated; set request.jwt.claim.sub = 'dddddddd-0000-0000-0000-00000000000d';   -- Calum
-- Travel time must be hours
select public.save_draft('2026-09-07', '{"days":[{"date":"2026-09-07","worked":true,"jobs":[{"jobNumber":"3105","mode":"times","start":"07:30","finish":"16:30","breakMins":30,"travel":"lots"}]},{"date":"2026-09-08","worked":false},{"date":"2026-09-09","worked":false},{"date":"2026-09-10","worked":false},{"date":"2026-09-11","worked":false},{"date":"2026-09-12","worked":false},{"date":"2026-09-13","worked":false}]}');
select public.t_error($$select public.submit_timesheet('2026-09-07', 'data:image/png;base64,' || repeat('A', 300), 'x')$$, '%travel time%', 'Travel that isn''t hours is refused');
-- Expenses must be pounds
select public.save_draft('2026-09-07', '{"days":[{"date":"2026-09-07","worked":true,"jobs":[{"jobNumber":"3105","mode":"times","start":"07:30","finish":"16:30","breakMins":30,"travel":"1.5"}]},{"date":"2026-09-08","worked":false},{"date":"2026-09-09","worked":false},{"date":"2026-09-10","worked":false},{"date":"2026-09-11","worked":false},{"date":"2026-09-12","worked":false},{"date":"2026-09-13","worked":false}],
  "expenses":[{"id":"1","jobNumber":"3105","amount":"twelve","description":"parking"}]}');
select public.t_error($$select public.submit_timesheet('2026-09-07', 'data:image/png;base64,' || repeat('A', 300), 'x')$$, '%expenses%', 'Expense that isn''t an amount is refused');
-- Only holiday or sick allowed as reasons for not working
select public.save_draft('2026-09-07', '{"days":[{"date":"2026-09-07","worked":false,"absence":"fishing"},{"date":"2026-09-08","worked":false},{"date":"2026-09-09","worked":false},{"date":"2026-09-10","worked":false},{"date":"2026-09-11","worked":false},{"date":"2026-09-12","worked":false},{"date":"2026-09-13","worked":false}]}');
select public.t_error($$select public.submit_timesheet('2026-09-07', 'data:image/png;base64,' || repeat('A', 300), 'x')$$, '%not valid%', 'Unknown absence type refused');
-- An empty week still can't be submitted
select public.save_draft('2026-09-07', '{"days":[{"date":"2026-09-07","worked":false},{"date":"2026-09-08","worked":false},{"date":"2026-09-09","worked":false},{"date":"2026-09-10","worked":false},{"date":"2026-09-11","worked":false},{"date":"2026-09-12","worked":false},{"date":"2026-09-13","worked":false}]}');
select public.t_error($$select public.submit_timesheet('2026-09-07', 'data:image/png;base64,' || repeat('A', 300), 'x')$$, '%worked, holiday or sick%', 'Empty week refused');
-- A week of holiday can be submitted
select public.save_draft('2026-09-07', '{"days":[{"date":"2026-09-07","worked":false,"absence":"holiday"},{"date":"2026-09-08","worked":false,"absence":"holiday"},{"date":"2026-09-09","worked":false,"absence":"holiday"},{"date":"2026-09-10","worked":false,"absence":"holiday"},{"date":"2026-09-11","worked":false,"absence":"holiday"},{"date":"2026-09-12","worked":false},{"date":"2026-09-13","worked":false}]}');
select public.t_check((public.submit_timesheet('2026-09-07', 'data:image/png;base64,' || repeat('A', 300), 'I confirm') ->> 'total_minutes')::int = 0, 'A holiday week can be submitted (0 hours worked)');
-- Travel, nights away, food, expenses and notes all accepted and kept
select public.save_draft('2026-08-31', '{"days":[
 {"date":"2026-08-31","worked":true,"away":true,"food":true,"jobs":[{"jobNumber":"3105","mode":"times","start":"07:30","finish":"16:30","breakMins":30,"travel":"1.5"}]},
 {"date":"2026-09-01","worked":true,"away":true,"food":true,"jobs":[{"jobNumber":"3105","mode":"times","start":"07:30","finish":"16:30","breakMins":30}]},
 {"date":"2026-09-02","worked":false,"absence":"sick"},
 {"date":"2026-09-03","worked":false},{"date":"2026-09-04","worked":false},{"date":"2026-09-05","worked":false},{"date":"2026-09-06","worked":false}],
 "expenses":[{"id":"1","jobNumber":"3105","amount":"£12.50","description":"parking"},{"id":"2","jobNumber":"3105","amount":"6","description":"screws"},{"id":"3","jobNumber":"","amount":"","description":""}],
 "notes":"Van broke down on Monday."}');
select public.t_check((public.submit_timesheet('2026-08-31', 'data:image/png;base64,' || repeat('A', 300), 'I confirm') ->> 'total_minutes')::int = 17*60, 'Week with travel, allowances, expenses and notes submits (17h)');
select public.t_check((select travel_minutes from public.job_entries where work_date = '2026-08-31') = 90, 'Travel time stored with the job (1h30)');
select public.t_check((select content -> 'expenses' -> 0 ->> 'amount' = '£12.50' and content ->> 'notes' = 'Van broke down on Monday.' from public.timesheets where week_start = '2026-08-31'), 'Expenses and notes kept with the week');
reset role;
select public.t_pass('FORM FIELD TESTS FINISHED');
