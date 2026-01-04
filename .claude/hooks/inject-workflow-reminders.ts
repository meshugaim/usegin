#!/usr/bin/env bun
/**
 * Hook to inject workflow reminders into Claude context
 *
 * Called from Claude hooks (SessionStart, Stop) via stdin JSON:
 * { "session_id": "..." }
 *
 * Outputs XML-formatted reminders to stdout.
 */

import { main } from "../../tools/workflow/src/inject-reminders-hook";

main();
