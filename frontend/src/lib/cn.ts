import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Fusionne des classes Tailwind conditionnelles — utilise par tout le kit d'interface partage. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
