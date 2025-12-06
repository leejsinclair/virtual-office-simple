/**
 * Jest Configuration for Frontend Tests
 *
 * Configures Jest for testing Next.js React components.
 * Uses next/jest to automatically handle Next.js-specific configurations.
 *
 * @module JestConfig
 */

const nextJest = require("next/jest");

/**
 * Create Jest configuration with Next.js integration
 *
 * This loads next.config.js and .env files into the test environment
 * so tests can access Next.js configuration and environment variables
 */
const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: "./",
});

/**
 * Custom Jest configuration options
 *
 * Extends the Next.js Jest config with additional settings
 */
const customJestConfig = {
  /**
   * Setup file to run before each test
   * Configures testing-library/jest-dom and browser API mocks
   */
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],

  /**
   * Test environment
   * Uses jsdom to simulate browser environment for React component tests
   */
  testEnvironment: "jest-environment-jsdom",

  /**
   * Module name mapping
   * Allows using @/ alias for imports (e.g., @/components/Button)
   */
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },

  /**
   * Test file patterns to match
   * Looks for test files in __tests__ directories or files ending in .test or .spec
   */
  testMatch: [
    "**/__tests__/**/*.[jt]s?(x)", // Files in __tests__ folders
    "**/?(*.)+(spec|test).[jt]s?(x)", // Files ending in .test or .spec
  ],

  /**
   * Coverage collection settings
   * Specifies which files to include in coverage reports
   */
  collectCoverageFrom: [
    "src/**/*.{js,jsx,ts,tsx}", // All source files
    "!src/**/*.d.ts", // Exclude TypeScript declaration files
    "!src/**/page.module.css", // Exclude CSS modules
  ],
};

/**
 * Export Jest configuration
 *
 * createJestConfig is exported this way to ensure that next/jest can load
 * the Next.js config which is async. This allows Next.js-specific features
 * to work properly in the test environment.
 */
module.exports = createJestConfig(customJestConfig);
