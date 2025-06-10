// Global test setup for Figma plugin tests

// Extend Jest matchers if needed
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidElement(): R;
      toHaveValidChanges(): R;
    }
  }
}

// Custom Jest matchers for plugin-specific assertions
expect.extend({
  toBeValidElement(received) {
    const isValid = received &&
      typeof received.id === 'string' &&
      typeof received.name === 'string' &&
      typeof received.type === 'string';
    
    if (isValid) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be a valid element`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be a valid element`,
        pass: false,
      };
    }
  },
  
  toHaveValidChanges(received) {
    const isValid = received &&
      Array.isArray(received.added) &&
      Array.isArray(received.modified) &&
      Array.isArray(received.removed);
    
    if (isValid) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to have valid changes structure`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to have valid changes structure`,
        pass: false,
      };
    }
  }
});

// Mock console methods for cleaner test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

beforeEach(() => {
  // Suppress console output during tests unless needed
  console.error = jest.fn();
  console.warn = jest.fn();
  console.log = jest.fn();
});

afterEach(() => {
  // Restore console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.log = originalConsoleLog;
});

// Make this an external module to fix TypeScript global augmentation error
export {}; 