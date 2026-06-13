/** Convert a title into a URL-safe slug base. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'item';
}

/**
 * Find an available slug for a tenant by appending -2, -3, … on collision.
 * `exists` checks whether a candidate is already taken.
 */
export async function uniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base);
  if (!(await exists(root))) return root;
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${root}-${i}`;
    if (!(await exists(candidate))) return candidate;
  }
  // Extremely unlikely; fall back to a timestamped suffix-free unique-ish value.
  return `${root}-${Math.floor(Math.random() * 1e6)}`;
}
