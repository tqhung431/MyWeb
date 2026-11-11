// "/login". The (auth) folder is a route group: it groups files without adding to the URL.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/features/auth/AuthForm";
import { AuthPage, githubErrorMessage, safeNext } from "@/features/auth/AuthPage";
import { getMe, getProviders } from "@/lib/api/server";

export const metadata: Metadata = { title: "Sign in" };

type Props = { searchParams: Promise<{ next?: string; error?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if ((await getMe()).user) redirect(next); // already signed in

  const providers = await getProviders();
  return (
    <AuthPage title="Welcome back" subtitle="Sign in to keep your focus streak going.">
      <AuthForm mode="login" next={next} github={providers.github} initialError={githubErrorMessage(params.error)} />
    </AuthPage>
  );
}
