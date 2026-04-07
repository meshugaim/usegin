/**
 * Parse a date argument into the date string and surrounding day boundaries.
 */
export function parseDate(input?: string): {
  dateStr: string;
  dayBefore: string;
  dayAfter: string;
} {
  let date: Date;

  if (!input || input === "yesterday") {
    date = new Date();
    date.setDate(date.getDate() - 1);
  } else if (input === "today") {
    date = new Date();
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    date = new Date(input + "T12:00:00Z"); // noon to avoid timezone edge
  } else {
    throw new Error(
      `Invalid date: "${input}". Use YYYY-MM-DD, "yesterday", or "today".`
    );
  }

  const dateStr = fmt(date);

  const before = new Date(date);
  before.setDate(before.getDate() - 1);

  const after = new Date(date);
  after.setDate(after.getDate() + 1);

  return { dateStr, dayBefore: fmt(before), dayAfter: fmt(after) };
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}
