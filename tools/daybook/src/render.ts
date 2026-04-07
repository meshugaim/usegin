import { marked } from "marked";
import { markedTerminal } from "marked-terminal";

marked.use(
  markedTerminal({
    showSectionPrefix: false,
    reflowText: false,
    tab: 2,
  })
);

/**
 * Render markdown to ANSI-formatted terminal output.
 */
export function renderTerminal(md: string): string {
  const rendered = marked.parse(md, { async: false }) as string;
  return rendered.trimEnd();
}
