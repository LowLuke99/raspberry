/**
 * Command palette matching + ranking.
 *
 * ── TUNABLE ──────────────────────────────────────────────────────────────
 * This is the one piece of Phase 1 with real behavioral trade-offs, so it's
 * deliberately isolated. The default below is a lightweight scorer:
 *   prefix match > word-boundary match > substring > keyword hit > subsequence
 * Swap in fuzzy libraries (fzf/fuse.js), recency weighting, or per-machine
 * boosting here without touching the palette UI.
 * ─────────────────────────────────────────────────────────────────────────
 */

export interface Command {
  id: string;
  label: string;
  hint?: string;
  keywords?: string[];
}

const SCORE = {
  prefix: 100,
  wordBoundary: 70,
  substring: 40,
  keyword: 30,
  subsequence: 10,
} as const;

function scoreCommand(query: string, cmd: Command): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1; // empty query keeps everything, original order

  const label = cmd.label.toLowerCase();

  if (label.startsWith(q)) return SCORE.prefix;
  if (new RegExp(`\\b${escapeRegExp(q)}`).test(label)) return SCORE.wordBoundary;
  if (label.includes(q)) return SCORE.substring;
  if (cmd.keywords?.some((k) => k.toLowerCase().includes(q))) return SCORE.keyword;
  if (isSubsequence(q, label)) return SCORE.subsequence;
  return 0;
}

/** Returns matching commands, best first. Stable for ties (original order). */
export function matchCommands<T extends Command>(query: string, commands: readonly T[]): T[] {
  return commands
    .map((item, index) => ({ item, index, score: scoreCommand(query, item) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((r) => r.item);
}

/** True if every char of `q` appears in `text` in order (fuzzy match). */
function isSubsequence(q: string, text: string): boolean {
  let i = 0;
  for (const ch of text) {
    if (ch === q[i]) i++;
    if (i === q.length) return true;
  }
  return q.length === 0;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
