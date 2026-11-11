// "/account" — only for signed-in people. The check happens on the server,
// so a signed-out visitor never even receives the page.

import { CalendarDays, Mail, MonitorSmartphone } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardHeader } from "@/components/ui/Card";
import { SignOutButton } from "@/features/auth/SignOutButton";
import { TodayStats } from "@/features/focus/TodayStats";
import { getMe } from "@/lib/api/server";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const { user } = await getMe();
  if (!user) redirect("/login?next=/account");

  const joined = new Date(user.createdAt).toLocaleDateString("en", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <section className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <Avatar name={user.name} size="lg" />
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{user.name}</h1>
          <p className="text-muted">{user.email}</p>
        </div>
        <SignOutButton />
      </section>

      <TodayStats />

      <Card>
        <CardHeader title="Account details" />
        <dl className="divide-y divide-border">
          <Row icon={Mail} label="Email" value={user.email} />
          <Row icon={CalendarDays} label="Joined" value={joined} />
          <Row icon={MonitorSmartphone} label="Devices" value="Sign in on any PC or phone on your network to see this history" />
        </dl>
      </Card>

      <p className="text-sm text-muted">
        Curious how sign-in works? It&apos;s explained step by step in <code>docs/stage-4.md</code>.{" "}
        <Link href="/about" className="font-semibold text-primary hover:underline">
          About MyWeb
        </Link>
      </p>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <Icon className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
      <dt className="w-24 shrink-0 font-semibold">{label}</dt>
      <dd className="min-w-0 truncate text-muted">{value}</dd>
    </div>
  );
}
