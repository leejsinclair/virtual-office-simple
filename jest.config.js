/**
 * Jest Configuration for Backend Tests
 *
 * Configures Jest for testing the Node.js backend server.
 * Tests run in a Node.js environment (not browser/jsdom).
 *
 * @module BackendJestConfig
 */

module.exports = {
  /**
   * Test environment
   * Uses Node.js environment for backend/server tests
   * (as opposed to 'jsdom' for frontend React component tests)
   */
  testEnvironment: "node",

  /**
   * Test file patterns
   * Only runs test files in the test/ directory
   */
  testMatch: ["**/test/**/*.test.js"],

  /**
   * Coverage collection settings
   * Specifies which files to include in coverage reports
   */
  collectCoverageFrom: [
    "index.js", // Main server file
    "!**/node_modules/**", // Exclude node_modules
  ],

  /**
   * Coverage output directory
   * Where to write coverage reports
   */
  coverageDirectory: "coverage",

  /**
   * Verbose output
   * Shows individual test results in the console
   */
  verbose: true,
};
