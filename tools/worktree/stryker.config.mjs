/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: "command",
  commandRunner: {
    command: "bun test",
  },
  mutate: [
    "src/**/*.ts",
    "!src/**/__tests__/**/*.ts",
    "!src/**/*.test.ts",
  ],
  reporters: ["html", "clear-text", "progress"],
  htmlReporter: {
    fileName: "reports/mutation/mutation.html",
  },
  coverageAnalysis: "off",
  timeoutMS: 60000,
  concurrency: 4,
};
