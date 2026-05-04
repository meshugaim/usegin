/**
 * `dx slack` static registry — channel name constants + workspace identifiers.
 *
 * Decouples Zisser's intent (#zisser-out) from Slack's runtime ids (Cxxxxx).
 * Lihu can rename a channel later and we update this file; calling code
 * stays put.
 *
 * `EXPECTED_REAL_TEAM_ID` is the team_id of the real AskEffi workspace,
 * verified live (auth.test) on 2026-05-04. `dx slack smoke` compares
 * against this to refuse to claim "operational" against the wrong tenant.
 *
 * Part of: ENG-5760
 */

/**
 * Channels Zisser refers to by intent. The actual channels are created by
 * `dx slack channel create` once Lihu's installed the bot in the real
 * workspace. Names start with `#zisser-` so they're greppable and obvious.
 */
export const ZISSER_CHANNELS = {
	/** Outbox — Brown relays, durable artifacts, anything Lihu should see. */
	outbox: "#zisser-out",
	/** Alerts — Sentry-driven, watcher-driven, urgency signal. */
	alerts: "#zisser-alerts",
	/** Log — append-only daily summaries. */
	log: "#zisser-log",
} as const;

export type ZisserChannelKey = keyof typeof ZISSER_CHANNELS;

/**
 * Team id of the real AskEffi workspace (verified via auth.test 2026-05-04).
 * Smoke compares this to the live auth.test response. If it ever changes
 * (e.g. workspace was migrated), update this constant in the same commit
 * that updates the bot's Doppler token.
 */
export const EXPECTED_REAL_TEAM_ID = "T0AUGMX1XNZ";
