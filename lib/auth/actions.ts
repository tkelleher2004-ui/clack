"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function getAuthErrorRedirectMessage(err: unknown): string {
  if (err instanceof Error) {
    const causeCode =
      typeof (err as Error & { cause?: { code?: string } }).cause?.code === "string"
        ? (err as Error & { cause?: { code?: string } }).cause?.code
        : undefined;

    if (
      err.message.toLowerCase().includes("fetch failed") ||
      causeCode === "ENOTFOUND" ||
      causeCode === "ECONNREFUSED" ||
      causeCode === "ETIMEDOUT"
    ) {
      return "Cannot reach Supabase auth. Check NEXT_PUBLIC_SUPABASE_URL and your network, then restart dev server.";
    }

    return err.message;
  }

  return "Sign in failed. Please try again.";
}

export async function signUpWithEmail(formData: FormData) {
  try {
    const supabase = await createClient();
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      redirect(`/signup?error=${encodeURIComponent(error.message)}`);
    }
  } catch (err) {
    redirect(`/signup?error=${encodeURIComponent(getAuthErrorRedirectMessage(err))}`);
  }
  redirect("/login?message=Check your email to confirm your account.");
}

export async function signInWithEmail(formData: FormData) {
  try {
    const supabase = await createClient();
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      redirect(`/login?error=${encodeURIComponent(error.message)}`);
    }
  } catch (err) {
    redirect(`/login?error=${encodeURIComponent(getAuthErrorRedirectMessage(err))}`);
  }
  redirect("/dashboard");
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  if (data?.url) redirect(data.url);
  redirect("/login?error=Could+not+get+Google+sign-in+URL");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
