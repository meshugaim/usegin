#!/usr/bin/env bun

interface StatusLineInput {
  session_id: string;
  version: string;
  model: {
    display_name: string;
  };
  context_window?: {
    used_percentage: number;
  };
}

const input: StatusLineInput = await Bun.stdin.json();

// ANSI color codes
const BOLD_BLACK_ON_YELLOW = "\x1b[1;30;48;2;255;255;0m"; // bold, black text, true color yellow (RGB 255,255,0)
const RESET = "\x1b[0m";

const parts: string[] = [];

parts.push(`v${input.version}`);

if (input.context_window?.used_percentage !== undefined) {
  parts.push(`Context: ${input.context_window.used_percentage}%`);
}

const isOpus = input.model.display_name.toLowerCase().includes("opus");
if (isOpus) {
  parts.push(`Model: ${input.model.display_name}`);
} else {
  parts.push(`Model: ${BOLD_BLACK_ON_YELLOW}${input.model.display_name}${RESET}`);
}
parts.push(`Session: ${input.session_id.slice(0, 8)}`);

console.log(parts.join(" | "));
