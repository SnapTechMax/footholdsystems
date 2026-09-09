/** Small helpers shared by the local scanner. No dependencies, no I/O. */

/** Runs `fn` over `items` with at most `limit` in flight. Order is preserved. */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

export function plural(count: number, noun: string, pluralNoun = `${noun}s`): string {
  return `${count} ${count === 1 ? noun : pluralNoun}`;
}

export function percent(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

/** Roughly four characters per token, the rule of thumb Ora's budget uses. */
export function approxTokens(text: string): number {
  return Math.round(text.length / 4);
}

export function daysAgo(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

/** Random path segment for probing how a site answers a page that cannot exist. */
export function randomSlug(): string {
  return `foothold-probe-${Math.random().toString(36).slice(2, 10)}`;
}
