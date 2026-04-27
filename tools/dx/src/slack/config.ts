/**
 * `dx slack` config — Slack bot-token loader for UseGin-Slack.
 *
 * Token lives in Doppler under `USEGIN_SLACK_BOT_TOKEN` (xoxb-…). One bot
 * token per UseGin Slack app per workspace. Mirrors the Unified-CLI pattern
 * in `tools/unified-cli/src/lib/config.ts` — env-only, no profile.
 *
 * Per `usegin/research/slack-integration/usegin-slack-team/whiteboard.md`:
 * the bot is infrastructure, not per-person credentials. Treat like
 * `LINEAR_API_KEY`: one shared secret, attribution lives in the message,
 * not on the wire.
 *
 * Part of: ENG-5408
 */

const ENV_VAR_BOT_TOKEN = "USEGIN_SLACK_BOT_TOKEN";

export interface SlackConfig {
  /** xoxb-* bot token. */
  botToken: string;
}

export class SlackConfigError extends Error {}

/**
 * Load the UseGin-Slack bot token from the environment.
 *
 * Throws `SlackConfigError` with a Doppler-shaped hint if the token is
 * missing — agents should let that bubble up so the human knows what to
 * do next.
 */
export function loadSlackConfig(
  env: NodeJS.ProcessEnv = process.env,
): SlackConfig {
  const botToken = env[ENV_VAR_BOT_TOKEN] ?? "";
  if (!botToken) {
    throw new SlackConfigError(
      `${ENV_VAR_BOT_TOKEN} is not set. Export it from Doppler before running ` +
        `(e.g. \`doppler run -- dx slack whoami\`). See ` +
        `usegin/research/slack-integration/usegin-slack-team/whiteboard.md ` +
        `and tools/dx/src/slack/README.md for setup.`,
    );
  }
  return { botToken };
}

/** Mask a token for human-readable display (`xoxb…abcd`). */
export function maskToken(token: string): string {
  if (token.length <= 8) return "***";
  // Bot tokens look like xoxb-1234-5678-AbCdEf — keep prefix + last 4.
  const prefix = token.startsWith("xoxb-") ? "xoxb" : token.slice(0, 4);
  return `${prefix}…${token.slice(-4)}`;
}

export const SLACK_BOT_TOKEN_ENV = ENV_VAR_BOT_TOKEN;
