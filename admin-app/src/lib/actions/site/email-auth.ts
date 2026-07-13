"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/current-user";
import { requestLoginCode, verifyLoginCodeFor } from "@/lib/email-login";
import { smtpConfigured } from "@/lib/email";

export type AuthFormState = { ok: boolean; message: string } | null;

export async function sendLoginCode(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  return requestLoginCode(String(formData.get("email") ?? ""));
}

export async function verifyLoginCode(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const result = await verifyLoginCodeFor(
    String(formData.get("email") ?? ""),
    String(formData.get("code") ?? ""),
  );
  if (!result.ok) return result;

  const store = await cookies();
  store.set(SESSION_COOKIE, result.user.id, { httpOnly: true, path: "/", sameSite: "lax" });
  redirect("/me");
}

export async function isSmtpConfigured() {
  return smtpConfigured();
}
