"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { brand } from "@/config/brand";
import { DEFAULT_COMPANY, DEMO_COMPANIES } from "@/config/demo-companies";
import { defaultPayrollWeek, fakeSheet } from "@/lib/demo-generator";
import { weekTotals } from "@/lib/hours";
import { forgetCompanies, getLiveUser } from "@/lib/live/context";
import { jobEntryRows, signaturePathToPng } from "@/lib/live/sample-data";
import { createServerAdminClient } from "@/lib/supabase/server";
import { addDays } from "@/lib/week";

export type ActionResult = { ok: true; message?: string; pins?: { name: string; pin: string }[] } | { ok: false; error: string };

/** Every action here checks again on the server that the super admin is signed in. */
async function requireSuperAdmin() {
  const me = await getLiveUser();
  if (me?.role !== "super_admin") throw new Error("Super admin only");
  return me;
}

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const fail = (error: string): ActionResult => ({ ok: false, error });

function checkAdminFields(name: string, email: string, password: string): string | null {
  if (name.length < 2) return "Enter the admin's full name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address for the admin.";
  if (password.length < 10) return "The temporary password needs at least 10 characters.";
  return null;
}

async function createCompanyAdmin(companyId: string, actorId: string, name: string, email: string, password: string): Promise<string | null> {
  const admin = createServerAdminClient();
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
  if (created.error || !created.data.user) {
    return /already|exists|registered/i.test(created.error?.message ?? "")
      ? "There's already an account with that email address."
      : "Couldn't create the sign-in for that admin. Please try again.";
  }
  const authUserId = created.data.user.id;
  const { data, error } = await admin
    .from("users")
    .insert({ company_id: companyId, role: "company_admin", auth_user_id: authUserId, full_name: name, email: email.toLowerCase(), created_by: actorId })
    .select("id")
    .single();
  if (error || !data) {
    // Don't leave a sign-in behind with no person attached to it.
    await admin.auth.admin.deleteUser(authUserId);
    return error?.code === "23505" ? "There's already an account with that email address." : "Couldn't save that admin. Please try again.";
  }
  await admin.from("audit_log").insert({ company_id: companyId, actor_user_id: actorId, target_user_id: data.id, action: "admin_added", details: { email: email.toLowerCase() } });
  return null;
}

/** New customer: the company itself and its first office admin. */
export async function createCompany(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const me = await requireSuperAdmin();
  const name = text(form, "name");
  const slug = text(form, "slug").toLowerCase();
  const keywords = text(form, "keywords")
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(Boolean);
  const entryMode = text(form, "entry_mode") === "hours-or-times" ? "hours-or-times" : "times";
  const adminName = text(form, "admin_name");
  const adminEmail = text(form, "admin_email");
  const adminPassword = String(form.get("admin_password") ?? "");

  if (name.length < 2) return fail("Enter the company name.");
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) return fail("The short name can only use lower-case letters, numbers and dashes (e.g. nicol).");
  if (keywords.length === 0) return fail("Enter at least one web address word (e.g. nicol).");
  if (keywords.some((k) => k.length < 4)) return fail("Web address words need at least 4 letters, so they don't match other addresses by accident.");
  const adminProblem = checkAdminFields(adminName, adminEmail, adminPassword);
  if (adminProblem) return fail(adminProblem);

  const admin = createServerAdminClient();
  const { data: clash } = await admin.from("companies").select("name").overlaps("host_keywords", keywords).limit(1);
  if (clash?.length) return fail(`${clash[0].name} already uses that web address word.`);

  const { data: company, error } = await admin
    .from("companies")
    .insert({
      name,
      slug,
      host_keywords: keywords,
      entry_mode: entryMode,
      show_overtime: form.get("show_overtime") === "on",
      is_test: form.get("is_test") === "on",
      payroll_email: text(form, "payroll_email") || null,
    })
    .select("id")
    .single();
  if (error || !company) return fail(error?.code === "23505" ? "That short name is already taken." : "Couldn't add the company. Please try again.");
  await admin.from("audit_log").insert({ company_id: company.id, actor_user_id: me.id, action: "company_added", details: { name, slug } });
  forgetCompanies();

  const adminError = await createCompanyAdmin(company.id, me.id, adminName, adminEmail, adminPassword);
  revalidatePath("/super");
  if (adminError) return fail(`${name} was added, but not its admin: ${adminError} Use "Add office admin" below to try again.`);
  return { ok: true, message: `${name} added. ${adminName} can sign in at /office on the company's web address.` };
}

export async function addCompanyAdmin(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const me = await requireSuperAdmin();
  const companyId = text(form, "company_id");
  const name = text(form, "admin_name");
  const email = text(form, "admin_email");
  const password = String(form.get("admin_password") ?? "");
  const problem = checkAdminFields(name, email, password);
  if (problem) return fail(problem);
  const error = await createCompanyAdmin(companyId, me.id, name, email, password);
  revalidatePath("/super");
  return error ? fail(error) : { ok: true, message: `${name} added as an office admin.` };
}

/** Customers who stop paying are switched off, never deleted. */
export async function setCompanyActive(companyId: string, active: boolean): Promise<ActionResult> {
  const me = await requireSuperAdmin();
  const admin = createServerAdminClient();
  const { error } = await admin.from("companies").update({ active }).eq("id", companyId);
  if (error) return fail("Couldn't change that company. Please try again.");
  await admin.from("audit_log").insert({ company_id: companyId, actor_user_id: me.id, action: active ? "company_reactivated" : "company_deactivated" });
  forgetCompanies();
  revalidatePath("/super");
  return { ok: true };
}

const SAMPLE_WEEKS = 6;

/**
 * Test companies only: adds a made-up team (with new random PINs, shown once)
 * and their last few weeks of timesheets, so the office side has data to try.
 */
export async function loadSampleData(companyId: string): Promise<ActionResult> {
  const me = await requireSuperAdmin();
  const admin = createServerAdminClient();
  const { data: company } = await admin.from("companies").select("id, name, slug, entry_mode, is_test").eq("id", companyId).maybeSingle();
  if (!company) return fail("Company not found.");
  if (!company.is_test) return fail("Sample data can only go into a test company.");
  const { count } = await admin.from("users").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("role", "worker");
  if (count) return fail("This company already has workers, so no sample data was added.");

  const template = DEMO_COMPANIES[company.slug] ?? DEFAULT_COMPANY;
  const config = { ...template, entryMode: company.entry_mode };
  const latest = defaultPayrollWeek();
  const weeks = Array.from({ length: SAMPLE_WEEKS }, (_, i) => addDays(latest, -7 * (SAMPLE_WEEKS - 1 - i)));
  const pins: { name: string; pin: string }[] = [];

  for (const [index, member] of config.team.entries()) {
    const pin = String(randomInt(0, 10_000)).padStart(4, "0");
    const { data: userId, error } = await admin.rpc("service_add_worker", {
      p_company_id: companyId,
      p_full_name: member.name,
      p_pin: pin,
      p_employee_number: `E${101 + index}`,
    });
    if (error || !userId) return fail(`Stopped at ${member.name}: ${error?.message ?? "couldn't add them"}. Workers added so far: ${pins.map((p) => `${p.name} (PIN ${p.pin})`).join(", ") || "none"}.`);
    pins.push({ name: member.name, pin });

    for (const week of weeks) {
      const { sheet } = fakeSheet(config, member, index, week);
      if (!sheet) continue;
      const totals = weekTotals(sheet.days, sheet.expenses);
      if (totals.daysWorked + totals.holidayDays + totals.sickDays === 0) continue;
      const { data: ts, error: tsError } = await admin
        .from("timesheets")
        .insert({
          company_id: companyId,
          user_id: userId,
          week_start: week,
          status: sheet.status,
          content: { weekStart: week, days: sheet.days, expenses: sheet.expenses ?? [], notes: sheet.notes ?? "" },
          reference: sheet.reference,
          total_minutes: totals.totalMinutes,
          submitted_at: sheet.submittedAt,
          approved_at: sheet.approvedAt ?? null,
        })
        .select("id")
        .single();
      if (tsError || !ts) return fail(`Workers were added (${pins.map((p) => `${p.name} PIN ${p.pin}`).join(", ")}) but a sample week failed: ${tsError?.message}`);
      const entries = jobEntryRows(sheet).map((e) => ({ ...e, timesheet_id: ts.id, company_id: companyId, user_id: userId }));
      if (entries.length) await admin.from("job_entries").insert(entries);
      await admin.from("signatures").insert({
        timesheet_id: ts.id,
        company_id: companyId,
        user_id: userId,
        image_png: signaturePathToPng(sheet.signaturePath ?? ""),
        declaration: brand.declaration,
        signed_at: sheet.submittedAt,
      });
    }
  }
  await admin.from("audit_log").insert({ company_id: companyId, actor_user_id: me.id, action: "sample_data_loaded", details: { workers: pins.length, weeks: SAMPLE_WEEKS } });
  revalidatePath("/super");
  return { ok: true, message: `Added ${pins.length} sample workers and ${SAMPLE_WEEKS} weeks of timesheets to ${company.name}.`, pins };
}
