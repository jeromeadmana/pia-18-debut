import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names, letting later Tailwind classes win over earlier ones.
 *
 * `clsx` handles the conditionals; `twMerge` resolves genuine conflicts, so a
 * component's default `px-4` is replaced by a caller's `px-8` rather than both
 * landing in the class list and leaving the winner to CSS source order.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
