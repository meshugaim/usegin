import {
  colors,
  dim,
  bold,
} from "../colors";

/**
 * Tree context data for an issue
 */
export interface IssueTreeContext {
  parent?: { identifier: string; title: string };
  siblings: Array<{ identifier: string; title: string; id: string }>;
  children: Array<{ identifier: string; title: string }>;
  currentIssueId: string;
}

/**
 * Format tree context for an issue
 */
export function formatTreeContext(context: IssueTreeContext): string {
  const lines: string[] = [];

  // Case 1: Issue has a parent (show parent with siblings including current issue)
  if (context.parent) {
    lines.push(`${colors.identifier(context.parent.identifier)} ${context.parent.title}`);

    // Show siblings (which includes the current issue)
    for (const sibling of context.siblings) {
      const isCurrentIssue = sibling.id === context.currentIssueId;
      const prefix = "  " + (sibling === context.siblings[context.siblings.length - 1] ? "\u2514\u2500 " : "\u251c\u2500 ");
      const marker = isCurrentIssue ? dim(" \u2190 (you are here)") : "";
      const titleColor = isCurrentIssue ? bold(sibling.title) : sibling.title;
      lines.push(`${prefix}${colors.identifier(sibling.identifier)} ${titleColor}${marker}`);
    }
  }
  // Case 2: No parent, but has children (show as top-level issue with children)
  else if (context.children.length > 0) {
    lines.push(`${colors.identifier(context.siblings[0].identifier)} ${bold(context.siblings[0].title)}${dim(" \u2190 (you are here)")}`);

    for (let i = 0; i < context.children.length; i++) {
      const child = context.children[i];
      const prefix = "  " + (i === context.children.length - 1 ? "\u2514\u2500 " : "\u251c\u2500 ");
      lines.push(`${prefix}${colors.identifier(child.identifier)} ${child.title}`);
    }
  }
  // Case 3: No parent, no children (standalone issue)
  else {
    lines.push(`${colors.identifier(context.siblings[0].identifier)} ${bold(context.siblings[0].title)}${dim(" \u2190 (you are here)")}`);
    lines.push(dim("  (no parent or children)"));
  }

  return lines.join("\n");
}
