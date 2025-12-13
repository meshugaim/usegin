import { Command } from "commander";
import DELEGATION_BRIEF_TEMPLATE from "../templates/delegation-brief.md" with { type: "text" };

export function generateBrief(issueId: string): string {
  return DELEGATION_BRIEF_TEMPLATE.replace(/\{\{ id \}\}/g, issueId);
}

export function createPromptCommand(): Command {
  return new Command("prompt")
    .description("Output delegation brief for an issue")
    .argument("<issue-id>", "Issue identifier (e.g., ENG-123)")
    .action((issueId: string) => {
      console.log(generateBrief(issueId));
    });
}
