// Joins class names, skipping false/undefined: cn("a", active && "b") → "a b"
import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
