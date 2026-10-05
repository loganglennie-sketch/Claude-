-- ═══════════════════════════════════════════════════════════════════════
--  Timesheets – workers choose their own PIN (run once in Supabase → SQL
--  Editor, after the earlier scripts)
--
--  • The PIN the office gives out is a starting PIN: the first time a worker
--    signs in, they choose their own. Same again after the office resets it.
--  • Workers can change their PIN any time (they must enter the current one).
--  • Easy-to-guess PINs (1234, 1111, …) are refused.
-- ═══════════════════════════════════════════════════════════════════════

alter table public.users add column pin_must_change boolean not null default true;
update public.users set pin_must_change = false where role <> 'worker';
grant select (pin_must_change) on public.users to authenticated;

-- Sign-in also says whether the worker still has to choose their own PIN.
create or replace function public.pin_sign_in(p_company_id uuid, p_name text, p_pin text, p_ip text default null, p_user_agent text default null)
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
    return jsonb_build_object('ok', true, 'user_id', u.id, 'auth_user_id', u.auth_user_id, 'full_name', u.full_name, 'must_change_pin', u.pin_must_change);
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

-- A reset PIN is a starting PIN again.
create or replace function public.admin_reset_pin(p_user_id uuid, p_new_pin text) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.users;
begin
  me := private.require_company_admin();
  perform private.check_pin(p_new_pin);
  update public.users set pin_hash = private.hash_pin(p_new_pin), pin_must_change = true, failed_attempts = 0, locked_until = null
   where id = p_user_id and company_id = me.company_id and role = 'worker';
  if not found then raise exception 'Worker not found.'; end if;
  perform private.log(me.company_id, me.id, p_user_id, 'pin_reset');
end $$;

-- 0000–9999 with all digits the same, or counting up/down (1234, 4321, 0123…).
create function private.weak_pin(p text) returns boolean language sql immutable as $$
  select p ~ '^(\d)\1{3}$' or p in ('0123','1234','2345','3456','4567','5678','6789','9876','8765','7654','6543','5432','4321','3210')
$$;

-- The worker (signed in) changes their own PIN. Wrong current PINs count towards the lock-out.
create function public.worker_change_pin(p_current_pin text, p_new_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.users;
begin
  me := private.require_worker();
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

revoke execute on function private.weak_pin(text) from public, anon, authenticated;
revoke execute on function public.worker_change_pin(text, text) from public, anon;
grant execute on function public.worker_change_pin(text, text) to authenticated;
revoke execute on function public.pin_sign_in(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.pin_sign_in(uuid, text, text, text, text) to service_role;
revoke execute on function public.admin_reset_pin(uuid, text) from public, anon;
grant execute on function public.admin_reset_pin(uuid, text) to authenticated;

notify pgrst, 'reload schema';

-- The app's open database connections remember the old table layout after a
-- change like the one above; close them so it reconnects with the new one.
select pg_terminate_backend(pid) from pg_stat_activity where usename = 'authenticator' and pid <> pg_backend_pid();
