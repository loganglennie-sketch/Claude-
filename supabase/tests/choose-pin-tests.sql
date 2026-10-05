-- Tests for workers choosing their own PIN (migration 20261007000000_workers_choose_pin.sql).
-- Run after security-tests.sql and form-fields-tests.sql (uses their people and helpers).
-- Calum's PIN was reset to 7777 by the office in security-tests.sql.
set role service_role;
select public.t_check((public.pin_sign_in('11111111-0000-0000-0000-000000000001', 'Calum Ross', '7777') ->> 'must_change_pin')::boolean, 'After the office resets a PIN, sign-in says "choose your own"');
reset role;

set role anon;
select public.t_error($$select public.worker_change_pin('7777', '4826')$$, '%permission denied%', 'Signed-out visitors cannot change PINs');
reset role;

set role authenticated; set request.jwt.claim.sub = 'dddddddd-0000-0000-0000-00000000000d';   -- Calum
select public.t_check(public.worker_change_pin('0000', '4826') ->> 'reason' = 'wrong_current', 'Wrong current PIN refused');
select public.t_check(public.worker_change_pin('7777', '7777') ->> 'reason' = 'same_as_current', 'New PIN must differ from the current one');
select public.t_check(public.worker_change_pin('7777', '1234') ->> 'reason' = 'too_easy', '1234 refused as too easy');
select public.t_check(public.worker_change_pin('7777', '5555') ->> 'reason' = 'too_easy', '5555 refused as too easy');
select public.t_check(public.worker_change_pin('7777', '48a6') ->> 'reason' = 'not_four_numbers', 'Must be 4 numbers');
select public.t_check((public.worker_change_pin('7777', '4826') ->> 'ok')::boolean, 'Worker chooses their own PIN');
select public.t_check((select not pin_must_change from public.users where full_name = 'Calum Ross'), '...and is no longer asked to');
select public.t_error($$select pin_hash from public.users$$, '%permission denied%', 'Worker still cannot read PIN hashes');
reset role;

set role service_role;
select public.t_check((public.pin_sign_in('11111111-0000-0000-0000-000000000001', 'Calum Ross', '4826') ->> 'ok')::boolean, 'New PIN signs in');
select public.t_check(not (public.pin_sign_in('11111111-0000-0000-0000-000000000001', 'Calum Ross', '4826') ->> 'must_change_pin')::boolean, '...without being asked to change it again');
select public.t_check(public.pin_sign_in('11111111-0000-0000-0000-000000000001', 'Calum Ross', '7777') ->> 'reason' = 'wrong', 'Old PIN no longer works');
reset role;

set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-00000000000a';   -- Nicol admin
select public.admin_reset_pin((select id from public.users where full_name = 'Calum Ross'), '2580');
select public.t_check((select pin_must_change from public.users where full_name = 'Calum Ross'), 'Office reset makes it a starting PIN again');
select public.t_error($$select public.worker_change_pin('2580', '9173')$$, '%sign in again%', 'Office admins cannot use the worker PIN change');
reset role;

-- Guessing the current PIN counts towards the lock-out
set role authenticated; set request.jwt.claim.sub = 'dddddddd-0000-0000-0000-00000000000d';
select public.worker_change_pin('0001', '9173'), public.worker_change_pin('0002', '9173'), public.worker_change_pin('0003', '9173'), public.worker_change_pin('0004', '9173');
select public.t_check(public.worker_change_pin('0005', '9173') ->> 'reason' = 'locked', '5 wrong current PINs lock the account');
select public.t_check(public.worker_change_pin('2580', '9173') ->> 'reason' = 'locked', '...even the right one is refused while locked');
reset role;
select public.t_check((select count(*) from public.audit_log where action = 'pin_changed') = 1, 'PIN change was logged');
select public.t_pass('CHOOSE-PIN TESTS FINISHED');
