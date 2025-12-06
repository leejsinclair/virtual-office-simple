/**
 * Jest Test Setup File
 *
 * Runs before each test file to configure the test environment.
 * Sets up global mocks and testing utilities.
 *
 * @module JestSetup
 */

// Learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";

/**
 * Mock window.matchMedia
 *
 * matchMedia is not available in jsdom by default.
 * This mock provides a basic implementation for tests that use media queries.
 *
 * @see https://jestjs.io/docs/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom
 */
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false, // Default: no media query matches
    media: query, // The media query string
    onchange: null, // Event handler (not used)
    addListener: jest.fn(), // Deprecated: add listener
    removeListener: jest.fn(), // Deprecated: remove listener
    addEventListener: jest.fn(), // Add event listener
    removeEventListener: jest.fn(), // Remove event listener
    dispatchEvent: jest.fn(), // Dispatch event
  })),
});

/**
 * Mock navigator.mediaDevices
 *
 * getUserMedia is not available in jsdom by default.
 * This mock allows tests to simulate camera/microphone access
 * without requiring actual hardware or browser permissions.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
 */
Object.defineProperty(navigator, "mediaDevices", {
  writable: true,
  value: {
    /**
     * Mock getUserMedia function
     * Returns a promise that resolves to a mock MediaStream
     *
     * @returns {Promise<MediaStream>} Mock media stream
     */
    getUserMedia: jest.fn().mockResolvedValue({
      getTracks: () => [], // Empty tracks array for mock stream
    }),
  },
});
