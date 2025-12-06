/**
 * Next.js Configuration
 *
 * Configuration file for Next.js framework.
 * Defines build settings, compiler options, and other framework settings.
 *
 * @module NextConfig
 */

import type { NextConfig } from "next";

/**
 * Next.js configuration object
 *
 * @see https://nextjs.org/docs/app/api-reference/next-config-js
 */
const nextConfig: NextConfig = {
  /* config options here */

  /**
   * Enable React Compiler
   * Automatically optimizes React components during build
   *
   * @see https://nextjs.org/docs/app/api-reference/next-config-js/reactCompiler
   */
  reactCompiler: true,
};

export default nextConfig;
