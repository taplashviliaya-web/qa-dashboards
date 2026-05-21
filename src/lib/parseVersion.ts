/**
 * Extract player version from an Epic title.
 *
 * Examples:
 *   "Video Player - Version Tests - v6.62-rc3 (Shadow DOM)" -> "6.62-rc3"
 *   "Video Player - Version Tests - v6.58-rc4 (Opportunity Trigger)" -> "6.58-rc4"
 *   "Video Player - Version Tests - v6.21-rc1" -> "6.21-rc1"
 */
export function parsePlayerVersion(title: string | null | undefined): string | undefined {
  if (!title || typeof title !== "string") return undefined;

  // Match `vX.Y` optionally followed by `.Z` and optionally `-rcN` or any
  // similar suffix made of alphanumerics. Anchored loosely so we capture the
  // first version-looking token in the title.
  const match = title.match(/v(\d+\.\d+(?:\.\d+)?(?:-[A-Za-z0-9]+)?)/);
  return match?.[1];
}
