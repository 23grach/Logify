/**
 * Global Test Setup for Figma Plugin Tests
 * 
 * This file configures the global test environment, custom matchers,
 * and common test utilities used across all test suites.
 * 
 * @fileoverview Test environment configuration and custom Jest matchers
 * for Figma plugin testing.
 */

/**
 * Custom Jest matchers for plugin-specific assertions
 */
declare global {
  interface CustomMatchers<R = unknown> {
    toBeValidElement(): R;
    toHaveValidChanges(): R;
  }
  
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Expect extends CustomMatchers {}
    interface Matchers<R> extends CustomMatchers<R> {}
    interface InverseAsymmetricMatchers extends CustomMatchers {}
  }
}

/**
 * Custom Jest matcher for validating design system elements
 * Checks if an object has the required properties of a valid element
 */
const toBeValidElement = {
  toBeValidElement(received: unknown) {
    const isValid = received &&
      typeof received === 'object' &&
      typeof (received as any).id === 'string' &&
      typeof (received as any).name === 'string' &&
      typeof (received as any).type === 'string';
    
    if (isValid) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be a valid element`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be a valid element with id, name, and type properties`,
        pass: false,
      };
    }
  }
};

/**
 * Custom Jest matcher for validating change detection results
 * Checks if an object has the required structure for change tracking
 */
const toHaveValidChanges = {
  toHaveValidChanges(received: unknown) {
    const isValid = received &&
      typeof received === 'object' &&
      Array.isArray((received as any).added) &&
      Array.isArray((received as any).modified) &&
      Array.isArray((received as any).removed);
    
    if (isValid) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to have valid changes structure`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to have valid changes structure with added, modified, and removed arrays`,
        pass: false,
      };
    }
  }
};

/**
 * Extend Jest with custom matchers
 */
expect.extend({
  ...toBeValidElement,
  ...toHaveValidChanges
});

/**
 * Console method references for restoration after tests
 */
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

/**
 * Global test setup - runs before each test
 * Suppresses console output during tests for cleaner test output
 */
beforeEach(() => {
  // Suppress console output during tests unless needed for debugging
  console.error = jest.fn();
  console.warn = jest.fn();
  console.log = jest.fn();
});

/**
 * Global test teardown - runs after each test
 * Restores original console methods
 */
afterEach(() => {
  // Restore console methods after each test
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.log = originalConsoleLog;
});

/**
 * Global test utilities available to all test suites
 */
global.testUtils = {
  /**
   * Creates a mock timestamp for consistent testing
   * @returns Fixed timestamp for deterministic tests
   */
  getMockTimestamp: (): number => 1640995200000, // 2022-01-01 00:00:00 UTC

  /**
   * Creates a delay for testing async operations
   * @param ms - Milliseconds to wait
   * @returns Promise that resolves after the specified delay
   */
  delay: (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Validates that an object has all required properties
   * @param obj - Object to validate
   * @param requiredProps - Array of required property names
   * @returns True if all required properties exist
   */
  hasRequiredProps: (obj: unknown, requiredProps: string[]): boolean => {
    if (!obj || typeof obj !== 'object') return false;
    return requiredProps.every(prop => prop in (obj as object));
  }
};

/**
 * Global type declarations for test utilities
 */
declare global {
  var testUtils: {
    getMockTimestamp(): number;
    delay(ms: number): Promise<void>;
    hasRequiredProps(obj: unknown, requiredProps: string[]): boolean;
  };
}

// Make this an external module to fix TypeScript global augmentation error
export {}; 