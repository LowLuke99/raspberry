/**
 * Tiny classname joiner — filters out falsey values so conditional classes
 * stay readable. Deliberately dependency-free (no clsx/tailwind-merge) to keep
 * the Phase 1 bundle lean; swap in tailwind-merge later if class conflicts bite.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
