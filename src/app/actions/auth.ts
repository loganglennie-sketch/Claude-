"use server";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { getLiveCompany } from "@/lib/live/context";
import { createServerAdminClient, createUserClient } from "@/lib/supabase/server";

export type SignInResult = { ok: true; redirectTo: string } | { ok: false; error: string };

const WRONG = "That name and PIN don't match. Check them and try again.";

async function requestInfo() {
  const h = await headers();
  return {
    ip: (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent"),
  };
}

/**
 * Workers never see or type this: it's the hidden Supabase password for their
 * account, worked out from a server-only secret. Their PIN is what they know.
 */
function hiddenPassword(userId: string): string {
  const secret = process.env.APP_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("APP_AUTH_SECRET is missing or too short");
  return createHmac("sha256", secret).update(`pin-login:${userId}`).digest("base64url");
}
const pinAccountEmail = (userId: string) => `pin-${userId}@${process.env.PIN_ACCOUNT_EMAIL_DOMAIN || "example.com"}`;

/** Name + 4-digit PIN for workers. */
export async function signInWithPin(name: string, pin: string): Promise<SignInResult> {
  const company = await getLiveCompany();
  if (!company) return { ok: false, error: "Sign-in isn't set up for this address yet." };
  if (!/^\d{4}$/.test(pin) || !name.trim()) return { ok: false, error: WRONG };

  const admin = createServerAdminClient();
  const { ip, userAgent } = await requestInfo();
  const { data, error } = await admin.rpc("pin_sign_in", {
    p_company_id: company.id,
    p_name: name,
    p_pin: pin,
    p_ip: ip,
    p_user_agent: userAgent,
  });
  if (error) return { ok: false, error: "Sorry, something went wrong. Please try again." };
  if (!data?.ok) {
    if (data?.reason === "locked") {
      return { ok: false, error: "Too many wrong PINs. Your account is locked for 15 minutes. Ask the office if you need it unlocked sooner." };
    }
    return { ok: false, error: WRONG };
  }

  // First ever sign-in: create the worker's (hidden) Supabase account, using the same id.
  const userId: string = data.user_id;
  const email = pinAccountEmail(userId);
  const password = hiddenPassword(userId);
  let authUserId: string | null = data.auth_user_id;
  if (!authUserId) {
    const created = await admin.auth.admin.createUser({ id: userId, email, password, email_confirm: true, app_metadata: { kind: "pin" } });
    if (created.error && !/already|exists|registered/i.test(created.error.message)) {
      return { ok: false, error: "Sorry, we couldn't set up your sign-in. Please tell the office." };
    }
    authUserId = created.data.user?.id ?? userId;
    await admin.rpc("link_auth_user", { p_user_id: userId, p_auth_user_id: authUserId });
  }

  const supabase = await createUserClient();
  let session = await supabase.auth.signInWithPassword({ email, password });
  if (session.error) {
    // The server secret may have been changed since last time: re-set the hidden password and retry.
    await admin.auth.admin.updateUserById(authUserId, { password });
    session = await supabase.auth.signInWithPassword({ email, password });
  }
  if (session.error) return { ok: false, error: "Sorry, we couldn't sign you in. Please try again." };
  return { ok: true, redirectTo: "/timesheet" };
}

/** Email + password for company admins and the super admin. */
export async function signInWithEmail(email: string, password: string): Promise<SignInResult> {
  const admin = createServerAdminClient();
  const { ip, userAgent } = await requestInfo();
  const supabase = await createUserClient();
  const { data: signedIn, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  await admin.rpc("log_admin_sign_in", { p_email: email.trim(), p_success: !error, p_ip: ip, p_user_agent: userAgent });
  if (error || !signedIn.user) return { ok: false, error: "That email and password don't match." };

  let { data: me } = await supabase.from("users").select("role, company_id, active").eq("auth_user_id", signedIn.user.id).maybeSingle();
  if (!me) me = await becomeFirstSuperAdmin(signedIn.user.id, signedIn.user.email);
  if (!me || !me.active || me.role === "worker") {
    await supabase.auth.signOut();
    return { ok: false, error: "This sign-in is for office staff. Workers sign in with their name and PIN." };
  }
  if (me.role === "super_admin") return { ok: true, redirectTo: "/super" };
  // Company admins can only use their own company's address.
  const company = await getLiveCompany();
  if (!company || company.id !== me.company_id) {
    await supabase.auth.signOut();
    return { ok: false, error: "Please sign in on your company's own web address." };
  }
  return { ok: true, redirectTo: "/payroll" };
}

/**
 * One-off setup: the owner (SUPER_ADMIN_EMAIL) becomes the super admin the
 * first time they sign in, as long as there isn't one already.
 */
async function becomeFirstSuperAdmin(authUserId: string, email: string | undefined) {
  const owner = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  if (!owner || !email || email.toLowerCase() !== owner) return null;
  const admin = createServerAdminClient();
  const { count } = await admin.from("users").select("id", { count: "exact", head: true }).eq("role", "super_admin");
  if (count !== 0) return null;
  const { data, error } = await admin
    .from("users")
    .insert({ role: "super_admin", company_id: null, auth_user_id: authUserId, full_name: "Super admin", email: email.toLowerCase() })
    .select("id, role, company_id, active")
    .single();
  if (error || !data) return null;
  await admin.from("audit_log").insert({ actor_user_id: data.id, target_user_id: data.id, action: "super_admin_created" });
  return data;
}

export async function signOutLive(): Promise<void> {
  const supabase = await createUserClient();
  await supabase.auth.signOut();
}
