"use client";

import React, { useState } from "react";
import { cn } from "./cn";

/** "Aisha Rahman" to "AR". First and last word, because middle names are noise. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0]![0]!.toUpperCase();
  return (words[0]![0]! + words[words.length - 1]![0]!).toUpperCase();
}

/* Five washes, each a token mixed into transparency, so every one of them keeps
   its contrast in all fourteen themes. A hue derived arithmetically from the
   name — the usual trick — lands wherever it lands, and a good proportion of
   "wherever" fails against a light surface. */
const WASHES = [
  "bg-[color-mix(in_srgb,var(--primary)_16%,transparent)] text-[var(--primary-strong)]",
  "bg-[color-mix(in_srgb,var(--success)_16%,transparent)] text-[var(--success-ink)]",
  "bg-[color-mix(in_srgb,var(--warning)_18%,transparent)] text-[var(--warning-ink)]",
  "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[var(--accent)]",
  "bg-[color-mix(in_srgb,var(--danger)_14%,transparent)] text-[var(--danger-ink)]",
];

/* From the NAME, never a row index. A colour is a memory aid, and one that
   changes when the list is sorted is not one. */
export function washFor(seed: string): string {
  return WASHES[[...seed].reduce((sum, character) => sum + character.charCodeAt(0), 0) % WASHES.length]!;
}

const SIZES = { xs: "size-6 text-[length:calc(8.5px*var(--fs-scale))]", sm: "size-7 text-[length:calc(9.5px*var(--fs-scale))]", md: "size-9 text-[length:calc(11px*var(--fs-scale))]", lg: "size-12 text-[length:calc(14px*var(--fs-scale))]" };

/**
 * A person, in a circle.
 *
 * The NAME is the identity and the initials are a drawing of it — a circle
 * reading "AR" and nothing else is two people in any tenant of any size, which
 * is why the accessible name is the full one.
 *
 * `decorative` for when something around it already says who this is: inside a
 * button labelled "Open profile menu", a second announcement of the same name
 * is noise.
 */
export function Avatar({ name, initials: given, src, size = "md", decorative, className }: {
  /** The person. Used as the accessible name and as the colour seed. */
  name: string;
  /**
   * When the data has initials but no full name.
   *
   * Some rows genuinely do — a notification carries "AR" and never the person
   * it stands for — and deriving "A" from "AR" would be worse than using what
   * is there.
   */
  initials?: string;
  src?: string;
  size?: keyof typeof SIZES;
  decorative?: boolean;
  className?: string;
}) {
  /* A photo that fails leaves the initials, not a broken-image glyph or an
     empty hole where a face was. */
  const [failed, setFailed] = useState(false);
  const initials = given ?? initialsOf(name);
  const showing = Boolean(src) && !failed;

  return (
    <span
      /* The wrapper carries the role and the name only when it IS the picture.
         With a photo inside, the <img> is already the image and already carries
         the name — two elements with role="img" and the same label is one
         person announced twice. */
      aria-label={decorative || showing ? undefined : name}
      aria-hidden={decorative || undefined}
      role={decorative || showing ? undefined : "img"}
      className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-black", SIZES[size], washFor(name), className)}
    >
      {showing ? (
        <img src={src} alt={decorative ? "" : name} onError={() => setFailed(true)} className="size-full object-cover" />
      ) : (
        <span aria-hidden>{initials}</span>
      )}
    </span>
  );
}
