import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/features/auth/AuthForm";
import { AuthPage, safeNext } from "@/features/auth/AuthPage";
import { getMe, getProviders } from "@/lib/api/server";

export const metadata: Metadata = { title: "Create account" };

type Props = { searchParams: Promise<{ next?: string }> };

export default async function RegisterPage({ searchParams }: Props) {
  const next = safeNext((await searchParams).next);
  if ((await getMe()).user) redirect(next);

  const providers = await getProviders();
  return (
    <AuthPage title="Create your account" subtitle="Free, and your history comes with you everywhere.">
      <AuthForm mode="register" next={next} github={providers.github} />
    </AuthPage>
  );
}
