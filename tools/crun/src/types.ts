/**
 * Process status values
 */
export type ProcessStatus = "running" | "done" | "errored" | "stopped" | "historical";

/**
 * A crun process record
 */
export interface CrunProcess {
  /** Session ID (UUID) */
  sessionId: string;
  /** pm2 process name (crun-$sessionId or crun-$sessionId-$issueId) */
  pm2Name: string;
  /** Current status */
  status: ProcessStatus;
  /** pm2 PID */
  pid?: number;
  /** Linked Linear issue ID */
  issueId?: string;
  /** When the process started */
  startedAt?: Date;
  /** When the process stopped */
  stoppedAt?: Date;
  /** Exit code if stopped */
  exitCode?: number;
  /** Original prompt (truncated) */
  prompt?: string;
}

/**
 * Options for spawning a new Claude process
 */
export interface SpawnOptions {
  /** The prompt to send to Claude */
  prompt: string;
  /** Stream output and exit when process completes */
  follow?: boolean;
  /** Link to Linear issue */
  issueId?: string;
  /** Resume existing session instead of creating new */
  resumeSessionId?: string;
  /** Override default model */
  model?: string;
}

/**
 * Result of spawning a new process
 */
export interface SpawnResult {
  /** The generated session ID */
  sessionId: string;
  /** The pm2 process name */
  pm2Name: string;
}

/**
 * pm2 process info (from pm2 jlist)
 */
export interface Pm2ProcessInfo {
  name: string;
  pm_id: number;
  pid: number;
  pm2_env: {
    status: string;
    pm_uptime: number;
    exit_code?: number;
    env?: Record<string, string>;
  };
}
