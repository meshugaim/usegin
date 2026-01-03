/**
 * Test setup file for crun tests
 *
 * This ensures pm2 connections are properly cleaned up after all tests,
 * preventing the test process from hanging.
 */

import { afterAll } from "bun:test";
import pm2 from "pm2";

// Ensure pm2 is disconnected after all tests complete
afterAll(() => {
  // Force disconnect pm2 to release any held connections
  try {
    pm2.disconnect();
  } catch {
    // Ignore errors - may already be disconnected
  }

  // Force exit after a short delay to handle any lingering async operations
  // This is necessary because pm2's bus connection and timers in followProcess
  // can keep the event loop alive even after tests complete
  setTimeout(() => {
    process.exit(0);
  }, 100);
});
