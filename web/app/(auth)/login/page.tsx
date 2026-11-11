// "/login". The (auth) folder is a route group: it groups files without adding to the URL.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/features/auth/AuthForm";
import { AuthPage, safeNext } from "@/features/auth/AuthPage";
import { getMe } from "@/lib/api/server";

export const metadata: Metadata = { title: "Sign in" };

type Props = { searchParams: Promise<{ next?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const next = safeNext((await searchParams).next);
  if ((await getMe()).user) redirect(next); // already signed in

  return (
    <AuthPage title="Welcome back" subtitle="Sign in to see your history from any PC.">
      <AuthForm mode="login" next={next} />
    </AuthPage>
  );
}
