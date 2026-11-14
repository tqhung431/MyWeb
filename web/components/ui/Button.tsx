// The one button style for every app. Pick a variant and a size instead of writing classes.
//   <Button variant="primary" size="lg">Start</Button>
//   <Link className={buttonClasses("secondary")} href="/focus">Open</Link>

import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const variants = {
  primary: "bg-linear-to-r from-primary to-primary-2 text-on-primary shadow-lg shadow-primary/30 hover:brightness-110",
  secondary: "border border-border bg-surface-strong/70 text-text hover:bg-surface-muted",
  ghost: "text-muted hover:bg-surface-muted hover:text-text",
  danger: "bg-rose-600 text-white shadow-lg shadow-rose-600/25 hover:bg-rose-700", // Stage 15: delete for good
  light: "bg-white text-slate-900 shadow-lg hover:bg-white/90", // Stage 18: on a coloured banner, in any theme
} as const;

const sizes = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5",
  lg: "h-14 px-8 text-lg",
  icon: "h-11 w-11",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

export function buttonClasses(variant: ButtonVariant = "secondary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full font-semibold transition",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

type Props = ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize };

export function Button({ variant, size, className, type = "button", ...props }: Props) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}
