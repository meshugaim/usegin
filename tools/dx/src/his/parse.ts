import { resolveAspect } from "./aspects";

export type ParsedRating = {
  scores: Array<{ aspect: string; score: number; original_key: string }>;
  note: string;
  warnings: string[];
};

export const SCORE_MIN = 1;
export const SCORE_MAX = 100;

export function parseRatingArgs(argv: string[]): ParsedRating {
  const tokens: string[] = [];
  for (const arg of argv) {
    for (const part of arg.split(",")) {
      const trimmed = part.trim();
      if (trimmed) tokens.push(trimmed);
    }
  }

  const scores: ParsedRating["scores"] = [];
  const noteParts: string[] = [];
  const warnings: string[] = [];

  for (const tok of tokens) {
    const eq = tok.indexOf("=");
    if (eq < 0) {
      noteParts.push(tok);
      continue;
    }
    const rawKey = tok.slice(0, eq);
    const rawVal = tok.slice(eq + 1);
    const aspect = resolveAspect(rawKey);
    if (!/^-?\d+$/.test(rawVal)) {
      warnings.push(`non-numeric value for ${aspect}: "${rawVal}" — skipped`);
      continue;
    }
    const score = parseInt(rawVal, 10);
    if (score < SCORE_MIN || score > SCORE_MAX) {
      warnings.push(`${aspect}=${score} outside ${SCORE_MIN}..${SCORE_MAX} (stored anyway)`);
    }
    scores.push({ aspect, score, original_key: rawKey });
  }

  return { scores, note: noteParts.join(" ").trim(), warnings };
}
