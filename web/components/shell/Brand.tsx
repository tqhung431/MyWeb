import { Moon } from "lucide-react";
import Link from "next/link";

export function Brand() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2.5 rounded-xl font-bold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-primary to-primary-2 text-white shadow-md shadow-primary/30">
        <Moon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="text-lg">Nook</span>
    </Link>
  );
}
