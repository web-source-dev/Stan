/** Apply a saved id list to items; unknown ids append at the end in original order. */
export function applyItemOrder<T extends { id: string }>(items: T[], order?: unknown): T[] {
  if (!Array.isArray(order) || order.length === 0) return items;
  const ids = order.map(String);
  const map = new Map(items.map((i) => [i.id, i]));
  const sorted = ids.map((id) => map.get(id)).filter((x): x is T => Boolean(x));
  const rest = items.filter((i) => !ids.includes(i.id));
  return [...sorted, ...rest];
}
