"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, authMode, createSessionToken, safeEqual } from "@/lib/auth/token";

export async function loginAction(_prev: { error?: string } | undefined, formData: FormData) {
  const mode = authMode();
  if (mode.mode === "misconfigured") {
    return { error: "Autenticação não configurada no servidor (APP_PASSWORD e SESSION_SECRET)." };
  }
  if (mode.mode === "enabled") {
    const password = String(formData.get("password") ?? "");
    // Small fixed delay slows down guessing.
    await new Promise((r) => setTimeout(r, 400));
    if (!safeEqual(password, mode.password)) return { error: "Senha incorreta." };
    (await cookies()).set(SESSION_COOKIE, await createSessionToken(mode.secret), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
  }
  redirect("/");
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
