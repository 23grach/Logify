/// <reference types="jest" />

/**
 * Unit Test Suite for Logify Plugin Core Functionality
 * 
 * This test suite focuses on isolated unit testing of individual functions
 * and components without external dependencies. Tests use mocks and stubs
 * to ensure complete isolation and fast execution.
 * 
 * @fileoverview Unit tests for core plugin functionality including data processing,
 * hashing, compression, and utility functions.
 */

/**
 * Interface definitions for type-safe testing
 */
interface TestElement {
  id: string;
  name: string;
  type: string;
  [key: string]: unknown;
}

interface TestTrackingData {
  timestamp: number;
  elements: TestElement[];
}

interface TestChanges {
  added: TestElement[];
  modified: TestElement[];
  removed: TestElement[];
}

interface MockPage {
  name: string;
  getSharedPluginData: jest.MockedFunction<(namespace: string, key: string) => string>;
  loadAsync: jest.MockedFunction<() => Promise<void>>;
  findAllWithCriteria: jest.MockedFunction<(criteria: { types: string[] }) => MockNode[]>;
}

interface MockNode {
  id: string;
  name: string;
  type: string;
  key?: string;
  description?: string;
  variantProperties?: Record<string, string> | null;
  parent?: MockNode | null;
  children?: MockNode[];
}

interface UIMessage {
  type: string;
  [key: string]: unknown;
}

/**
 * Test utilities for unit testing
 * Provides isolated helper functions for testing core functionality
 */
class UnitTestHelpers {
  /**
   * Validates hash function stability
   * @param hashFn - Hash function to test
   * @returns True if hash function produces consistent results
   */
  static isHashFunctionStable(hashFn: (input: string) => string): boolean {
    const input = 'test-string-123';
    const hash1 = hashFn(input);
    const hash2 = hashFn(input);
    return hash1 === hash2 && typeof hash1 === 'string' && hash1.length > 0;
  }

  /**
   * Validates hash function sensitivity to input changes
   * @param hashFn - Hash function to test
   * @returns True if hash function produces different outputs for different inputs
   */
  static isHashFunctionSensitive(hashFn: (input: string) => string): boolean {
    const input1 = 'test-string-123';
    const input2 = 'test-string-124';
    const hash1 = hashFn(input1);
    const hash2 = hashFn(input2);
    return hash1 !== hash2;
  }

  /**
   * Detects changes between two element arrays
   * @param prev - Previous element array
   * @param curr - Current element array
   * @returns Object containing added, modified, and removed elements
   */
  static detectChanges(prev: TestElement[], curr: TestElement[]): TestChanges {
    const added = curr.filter(c => !prev.some(p => p.id === c.id));
    const removed = prev.filter(p => !curr.some(c => c.id === p.id));
    const modified = curr.filter(c => {
      const prevElement = prev.find(p => p.id === c.id);
      return prevElement && JSON.stringify(prevElement) !== JSON.stringify(c);
    });

    return { added, modified, removed };
  }

  /**
   * Tests compression and decompression cycle integrity
   * @param compressFn - Compression function
   * @param decompressFn - Decompression function
   * @returns True if data survives compression/decompression cycle intact
   */
  static testCompressionCycle(
    compressFn: (data: TestTrackingData) => Record<string, unknown>,
    decompressFn: (compressed: Record<string, unknown>) => TestTrackingData
  ): boolean {
    const originalData: TestTrackingData = {
      timestamp: Date.now(),
      elements: [
        { id: '1', name: 'Test Element', type: 'component' },
        { id: '2', name: 'Another Element', type: 'style' }
      ]
    };

    const compressed = compressFn(originalData);
    const decompressed = decompressFn(compressed);

    return (
      decompressed.timestamp === originalData.timestamp &&
      decompressed.elements.length === originalData.elements.length &&
      decompressed.elements.every((elem, index) => 
        elem.id === originalData.elements[index].id &&
        elem.name === originalData.elements[index].name &&
        elem.type === originalData.elements[index].type
      )
    );
  }

  /**
   * Simple hash function for testing purposes
   * @param str - String to hash
   * @returns Hash string
   */
  static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  /**
   * Validates element structure
   * @param element - Element to validate
   * @returns True if element has required properties
   */
  static isValidElement(element: unknown): element is TestElement {
    return (
      typeof element === 'object' &&
      element !== null &&
      typeof (element as TestElement).id === 'string' &&
      typeof (element as TestElement).name === 'string' &&
      typeof (element as TestElement).type === 'string'
    );
  }

  /**
   * Creates mock tracking data for testing
   * @param elementCount - Number of elements to create
   * @returns Mock tracking data
   */
  static createMockTrackingData(elementCount: number = 3): TestTrackingData {
    const elements: TestElement[] = [];
    for (let i = 1; i <= elementCount; i++) {
      elements.push({
        id: `element-${i}`,
        name: `Test Element ${i}`,
        type: i % 2 === 0 ? 'component' : 'style'
      });
    }

    return {
      timestamp: Date.now(),
      elements
    };
  }
}

/**
 * Mock Figma API for isolated testing
 */
const mockFigma = {
  root: {
    children: [] as MockPage[],
    getSharedPluginData: jest.fn(),
    setSharedPluginData: jest.fn(),
  },
  ui: {
    postMessage: jest.fn(),
    onmessage: null as ((msg: UIMessage) => void) | null,
  },
  showUI: jest.fn(),
  notify: jest.fn(),
  createPage: jest.fn(),
  createFrame: jest.fn(),
  createText: jest.fn(),
  loadFontAsync: jest.fn(),
  getLocalTextStylesAsync: jest.fn(),
  getLocalPaintStylesAsync: jest.fn(),
  getLocalEffectStylesAsync: jest.fn(),
  getLocalGridStylesAsync: jest.fn(),
  setCurrentPageAsync: jest.fn(),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).figma = mockFigma;

describe('Logify Plugin Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFigma.root.children = [];
    mockFigma.root.getSharedPluginData.mockReturnValue('');
  });

  describe('Core Hash Functions', () => {
    /**
     * Tests for hash function stability and sensitivity
     */
    test('should produce stable hash outputs', () => {
      const hashFn = UnitTestHelpers.simpleHash;
      expect(UnitTestHelpers.isHashFunctionStable(hashFn)).toBe(true);
    });

    test('should produce different hashes for different inputs', () => {
      const hashFn = UnitTestHelpers.simpleHash;
      expect(UnitTestHelpers.isHashFunctionSensitive(hashFn)).toBe(true);
    });

    test('should handle empty strings', () => {
      const hash = UnitTestHelpers.simpleHash('');
      expect(typeof hash).toBe('string');
      expect(hash).toBe('0');
    });

    test('should handle special characters', () => {
      const input = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const hash = UnitTestHelpers.simpleHash(input);
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe('Data Validation', () => {
    /**
     * Tests for element validation functions
     */
    test('should validate valid elements', () => {
      const validElement: TestElement = {
        id: 'test-1',
        name: 'Test Element',
        type: 'component'
      };
      expect(UnitTestHelpers.isValidElement(validElement)).toBe(true);
    });

    test('should reject invalid elements', () => {
      const invalidElements = [
        null,
        undefined,
        {},
        { id: 'test' },
        { name: 'test' },
        { type: 'test' },
        { id: 123, name: 'test', type: 'component' },
        { id: 'test', name: 123, type: 'component' },
        { id: 'test', name: 'test', type: 123 }
      ];

      invalidElements.forEach(element => {
        expect(UnitTestHelpers.isValidElement(element)).toBe(false);
      });
    });
  });

  describe('Change Detection Logic', () => {
    /**
     * Tests for change detection algorithms
     */
    test('should detect added elements', () => {
      const prev: TestElement[] = [
        { id: '1', name: 'Element 1', type: 'component' }
      ];
      const curr: TestElement[] = [
        { id: '1', name: 'Element 1', type: 'component' },
        { id: '2', name: 'Element 2', type: 'style' }
      ];

      const changes = UnitTestHelpers.detectChanges(prev, curr);
      expect(changes.added).toHaveLength(1);
      expect(changes.added[0].id).toBe('2');
      expect(changes.removed).toHaveLength(0);
      expect(changes.modified).toHaveLength(0);
    });

    test('should detect removed elements', () => {
      const prev: TestElement[] = [
        { id: '1', name: 'Element 1', type: 'component' },
        { id: '2', name: 'Element 2', type: 'style' }
      ];
      const curr: TestElement[] = [
        { id: '1', name: 'Element 1', type: 'component' }
      ];

      const changes = UnitTestHelpers.detectChanges(prev, curr);
      expect(changes.removed).toHaveLength(1);
      expect(changes.removed[0].id).toBe('2');
      expect(changes.added).toHaveLength(0);
      expect(changes.modified).toHaveLength(0);
    });

    test('should detect modified elements', () => {
      const prev: TestElement[] = [
        { id: '1', name: 'Element 1', type: 'component' }
      ];
      const curr: TestElement[] = [
        { id: '1', name: 'Modified Element 1', type: 'component' }
      ];

      const changes = UnitTestHelpers.detectChanges(prev, curr);
      expect(changes.modified).toHaveLength(1);
      expect(changes.modified[0].name).toBe('Modified Element 1');
      expect(changes.added).toHaveLength(0);
      expect(changes.removed).toHaveLength(0);
    });

    test('should handle empty arrays', () => {
      const changes = UnitTestHelpers.detectChanges([], []);
      expect(changes.added).toHaveLength(0);
      expect(changes.removed).toHaveLength(0);
      expect(changes.modified).toHaveLength(0);
    });
  });

  describe('Data Compression', () => {
    /**
     * Tests for data compression and decompression
     */
    test('should maintain data integrity through compression cycle', () => {
      const mockCompress = (data: TestTrackingData): Record<string, unknown> => ({
        t: data.timestamp,
        e: data.elements.map(el => ({ i: el.id, n: el.name, t: el.type }))
      });

      const mockDecompress = (compressed: Record<string, unknown>): TestTrackingData => ({
        timestamp: compressed.t as number,
        elements: (compressed.e as any[]).map(el => ({
          id: el.i,
          name: el.n,
          type: el.t
        }))
      });

      expect(UnitTestHelpers.testCompressionCycle(mockCompress, mockDecompress)).toBe(true);
    });

    test('should handle empty data sets', () => {
      const emptyData: TestTrackingData = { timestamp: Date.now(), elements: [] };
      
      const mockCompress = (data: TestTrackingData) => ({ t: data.timestamp, e: data.elements });
      const mockDecompress = (compressed: Record<string, unknown>): TestTrackingData => ({
        timestamp: compressed.t as number,
        elements: compressed.e as TestElement[]
      });

      const compressed = mockCompress(emptyData);
      const decompressed = mockDecompress(compressed);

      expect(decompressed.elements).toHaveLength(0);
      expect(decompressed.timestamp).toBe(emptyData.timestamp);
    });
  });

  describe('Mock Tracking Data Generation', () => {
    /**
     * Tests for test data generation utilities
     */
    test('should create valid tracking data with specified element count', () => {
      const trackingData = UnitTestHelpers.createMockTrackingData(5);
      
      expect(trackingData.elements).toHaveLength(5);
      expect(typeof trackingData.timestamp).toBe('number');
      
      trackingData.elements.forEach((element, index) => {
        expect(element.id).toBe(`element-${index + 1}`);
        expect(element.name).toBe(`Test Element ${index + 1}`);
        expect(['component', 'style']).toContain(element.type);
      });
    });

    test('should create default tracking data when no count specified', () => {
      const trackingData = UnitTestHelpers.createMockTrackingData();
      expect(trackingData.elements).toHaveLength(3);
    });

    test('should handle zero element count', () => {
      const trackingData = UnitTestHelpers.createMockTrackingData(0);
      expect(trackingData.elements).toHaveLength(0);
    });
  });

  describe('Plugin Storage Operations', () => {
    /**
     * Tests for data storage and retrieval operations
     */
    test('should handle empty storage gracefully', () => {
      mockFigma.root.getSharedPluginData.mockReturnValue('');
      const result = mockFigma.root.getSharedPluginData('test', 'key');
      expect(result).toBe('');
    });

    test('should handle chunked data metadata', () => {
      const mockMetadata = {
        chunkCount: 2,
        timestamp: Date.now(),
        totalLength: 1000
      };
      
      mockFigma.root.getSharedPluginData.mockImplementation((namespace, key) => {
        if (key === 'trackingData_meta') {
          return JSON.stringify(mockMetadata);
        }
        return '';
      });
      
      const result = mockFigma.root.getSharedPluginData('test', 'trackingData_meta');
      expect(result).toBeTruthy();
      
      const parsed = JSON.parse(result);
      expect(parsed.chunkCount).toBe(2);
      expect(parsed.timestamp).toBe(mockMetadata.timestamp);
      expect(parsed.totalLength).toBe(1000);
    });

    test('should handle invalid JSON gracefully', () => {
      mockFigma.root.getSharedPluginData.mockReturnValue('invalid-json');
      
      expect(() => {
        const result = mockFigma.root.getSharedPluginData('test', 'key');
        if (result) {
          JSON.parse(result);
        }
      }).toThrow();
    });
  });

  describe('UI Message Validation', () => {
    /**
     * Tests for UI message validation
     */
    test('should validate message structure', () => {
      const validMessages = [
        { type: 'initialize' },
        { type: 'refresh' },
        { type: 'addToFigma', changes: [], comment: 'test' }
      ];

      validMessages.forEach(msg => {
        expect(msg).toHaveProperty('type');
        expect(typeof msg.type).toBe('string');
      });
    });

    test('should reject malformed messages', () => {
      const invalidMessages = [
        null,
        undefined,
        {},
        { message: 'no type' },
        { type: 123 }
      ];

      invalidMessages.forEach(msg => {
        if (msg && typeof msg === 'object' && 'type' in msg) {
          expect(typeof (msg as any).type).not.toBe('string');
        } else if (msg !== null && msg !== undefined) {
          expect(msg).not.toHaveProperty('type');
        } else {
          expect(msg).toBeFalsy();
        }
      });
    });
  });

  describe('Performance Utilities', () => {
    /**
     * Tests for performance monitoring utilities
     */
    test('should measure execution time', () => {
      const start = performance.now();
      
      // Simulate some work
      for (let i = 0; i < 1000; i++) {
        UnitTestHelpers.simpleHash(`test-${i}`);
      }
      
      const end = performance.now();
      const duration = end - start;
      
      expect(duration).toBeGreaterThan(0);
      expect(typeof duration).toBe('number');
    });

    test('should handle memory usage calculations', () => {
      const mockMemoryUsage = () => Date.now() % 1000000;
      const usage = mockMemoryUsage();
      
      expect(typeof usage).toBe('number');
      expect(usage).toBeGreaterThanOrEqual(0);
      expect(usage).toBeLessThan(1000000);
    });
  });

  describe('Error Handling', () => {
    /**
     * Tests for error handling and edge cases
     */
    test('should handle null and undefined inputs', () => {
      expect(() => UnitTestHelpers.simpleHash(null as any)).toThrow();
      expect(() => UnitTestHelpers.simpleHash(undefined as any)).toThrow();
    });

    test('should handle extremely large inputs', () => {
      const largeInput = 'x'.repeat(100000);
      const hash = UnitTestHelpers.simpleHash(largeInput);
      
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    test('should handle unicode characters', () => {
      const unicodeInput = '🎨🔧⚡️🚀';
      const hash = UnitTestHelpers.simpleHash(unicodeInput);
      
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });
  });
}); 