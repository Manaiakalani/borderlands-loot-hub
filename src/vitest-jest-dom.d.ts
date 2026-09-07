/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

declare module "vitest" {
  interface Assertion<R extends void | Promise<void> = void, _T = unknown>
    extends TestingLibraryMatchers<unknown, R> {}
  interface AsymmetricMatchersContaining
    extends TestingLibraryMatchers<unknown, unknown> {}
}

export {};
