-- ═══════════════════════════════════════════════════════════════════════
--  Timesheets – Phase 1, part 2 (run once in Supabase → SQL Editor,
--  after 20261004000000_phase1_backend.sql)
--
--  Adds a server-only helper so the super admin page can set up workers
--  (for example a test company's sample team) with properly hashed PINs.
-- ═══════════════════════════════════════════════════════════════════════

create function public.service_add_worker(p_company_id uuid, p_full_name text, p_pin text, p_employee_number text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid; clean_name text := regexp_replace(btrim(p_full_name), '\s+', ' ', 'g');
begin
  perform private.check_pin(p_pin);
  if exists (select 1 from public.users where company_id = p_company_id and active and name_key = private.normalise_name(clean_name)) then
    raise exception 'Someone called "%" already works here.', clean_name using errcode = '23505';
  end if;
  insert into public.users (company_id, role, full_name, employee_number, pin_hash)
  values (p_company_id, 'worker', clean_name, nullif(btrim(p_employee_number), ''), private.hash_pin(p_pin))
  returning id into new_id;
  perform private.log(p_company_id, null, new_id, 'worker_added', jsonb_build_object('full_name', clean_name, 'by', 'super_admin'));
  return new_id;
end $$;

revoke execute on function public.service_add_worker(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.service_add_worker(uuid, text, text, text) to service_role;

-- Tell the API about the new function straight away.
notify pgrst, 'reload schema';
