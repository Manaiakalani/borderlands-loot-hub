import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Writes text to the clipboard, resolving to whether it succeeded.
 *
 * `navigator.clipboard?.writeText(...)` is not sufficient on its own: optional
 * chaining only guards `navigator.clipboard` being nullish. When the object
 * exists but `writeText` does not (older browsers, non-secure contexts, some
 * sandboxed iframes), invoking it throws a TypeError synchronously. This helper
 * checks the method itself and converts every failure mode into `false`.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator === "undefined") return false;
    if (typeof navigator.clipboard?.writeText !== "function") return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
