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

const parts: string[] = [];

parts.push(`v${input.version}`);

if (input.context_window?.used_percentage !== undefined) {
  parts.push(`Context: ${input.context_window.used_percentage}%`);
}

parts.push(`Model: ${input.model.display_name}`);
parts.push(`Session: ${input.session_id.slice(0, 8)}`);

console.log(parts.join(" | "));
