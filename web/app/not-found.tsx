import { Compass } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <span className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/15 text-primary">
        <Compass className="h-8 w-8" aria-hidden="true" />
      </span>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">Nothing here</h1>
      <p className="mt-2 text-muted">This page drifted away.</p>
      <Link href="/" className={buttonClasses("primary", "md", "mt-6")}>
        Back home
      </Link>
    </div>
  );
}
