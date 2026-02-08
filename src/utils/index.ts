/**
 * Pure helpers and utilities.
 */

import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class names with proper override behavior.
 * Use for conditional or combined className props.
 */
export function cn(...inputs: Parameters<typeof twMerge>) {
  return twMerge(inputs);
}
