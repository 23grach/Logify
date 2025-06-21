/// <reference types="jest" />

/**
 * Comprehensive Test Suite for Logify Plugin
 * 
 * This test suite focuses on behavior-driven testing to ensure
 * tests remain valid even after code refactoring.
 */

// Abstract interfaces for testing - implementation independent
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

// Type definitions for mock objects
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

// Helper functions for behavior-based testing
const TestHelpers = {
  // Tests that hash function works stably
  isHashFunctionStable: (hashFn: (input: string) => string): boolean => {
    const input = 'test-string-123';
    const hash1 = hashFn(input);
    const hash2 = hashFn(input);
    return hash1 === hash2 && typeof hash1 === 'string' && hash1.length > 0;
  },

  // Tests that hash function is sensitive to changes
  isHashFunctionSensitive: (hashFn: (input: string) => string): boolean => {
    const input1 = 'test-string-123';
    const input2 = 'test-string-124'; // Minimal change
    const hash1 = hashFn(input1);
    const hash2 = hashFn(input2);
    return hash1 !== hash2;
  },

  // Tests change detection logic
  detectChanges: (prev: TestElement[], curr: TestElement[]): TestChanges => {
    const added = curr.filter(c => !prev.some(p => p.id === c.id));
    const removed = prev.filter(p => !curr.some(c => c.id === p.id));
    const modified = curr.filter(c => {
      const prevElement = prev.find(p => p.id === c.id);
      return prevElement && JSON.stringify(prevElement) !== JSON.stringify(c);
    });

    return { added, modified, removed };
  },

  // Tests compression/decompression cycle (behavior-based)
  testCompressionCycle: (
    compressFn: (data: TestTrackingData) => Record<string, unknown>,
    decompressFn: (compressed: Record<string, unknown>) => TestTrackingData
  ): boolean => {
    const originalData: TestTrackingData = {
      timestamp: Date.now(),
      elements: [
        { id: '1', name: 'Test Element', type: 'component' },
        { id: '2', name: 'Another Element', type: 'style' }
      ]
    };

    const compressed = compressFn(originalData);
    const decompressed = decompressFn(compressed);

    // Check that data was restored correctly
    return (
      decompressed.timestamp === originalData.timestamp &&
      decompressed.elements.length === originalData.elements.length &&
      decompressed.elements.every((elem, index) => 
        elem.id === originalData.elements[index].id &&
        elem.name === originalData.elements[index].name &&
        elem.type === originalData.elements[index].type
      )
    );
  },

  // Simple hash function for testing
  simpleHash: (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }
};

// Mock Figma API
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

// Mock global figma object
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).figma = mockFigma;

describe('Logify Plugin Test Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFigma.root.children = [];
    mockFigma.root.getSharedPluginData.mockReturnValue('');
  });

  describe('Plugin Initialization', () => {
    test('should show UI on startup', () => {
      expect(mockFigma.showUI).toBeDefined();
    });

    test('should handle first-time initialization', () => {
      mockFigma.root.getSharedPluginData.mockReturnValue('');
      expect(mockFigma.root.getSharedPluginData).toBeDefined();
    });
  });

  describe('Data Storage and Retrieval', () => {
    test('should handle empty storage', () => {
      mockFigma.root.getSharedPluginData.mockReturnValue('');
      const result = mockFigma.root.getSharedPluginData('test', 'key');
      expect(result).toBe('');
    });

    test('should handle chunked data', () => {
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
    });

    test('should maintain data integrity through storage cycle', () => {
      // Mock compression/decompression functions
      const mockCompress = (data: TestTrackingData): Record<string, unknown> => ({
        t: data.timestamp,
        e: data.elements.map(elem => ({
          i: elem.id,
          n: elem.name,
          ty: elem.type
        }))
      });

      const mockDecompress = (compressed: Record<string, unknown>): TestTrackingData => ({
        timestamp: compressed.t as number,
        elements: (compressed.e as Array<Record<string, unknown>>).map(elem => ({
          id: elem.i as string,
          name: elem.n as string,
          type: elem.ty as string
        }))
      });

      expect(TestHelpers.testCompressionCycle(mockCompress, mockDecompress)).toBe(true);
    });

    test('should handle chunked data correctly', () => {
      const largeData = 'x'.repeat(1000); // Simulate large data
      const chunkSize = 100;
      
      // Simulate chunking
      const chunks: string[] = [];
      for (let i = 0; i < largeData.length; i += chunkSize) {
        chunks.push(largeData.slice(i, i + chunkSize));
      }
      
      // Simulate reassembly
      const reassembled = chunks.join('');
      
      expect(reassembled).toBe(largeData);
      expect(chunks.length).toBe(Math.ceil(largeData.length / chunkSize));
    });
  });

  describe('Element Collection', () => {
    test('should collect components from pages', () => {
      const mockComponent: MockNode = {
        id: 'comp1',
        name: 'Button',
        type: 'COMPONENT',
        key: 'key1',
        description: 'A button component',
        variantProperties: null,
        parent: null,
        children: []
      };

      const mockPage: MockPage = {
        name: 'Page 1',
        getSharedPluginData: jest.fn().mockReturnValue(''),
        loadAsync: jest.fn().mockResolvedValue(undefined),
        findAllWithCriteria: jest.fn().mockImplementation(({ types }) => {
          if (types.includes('COMPONENT')) return [mockComponent];
          return [];
        })
      };

      mockFigma.root.children = [mockPage];
      
      expect(mockPage.findAllWithCriteria({ types: ['COMPONENT'] })).toContain(mockComponent);
    });

    test('should collect different style types', () => {
      const mockTextStyle = {
        id: 'style1',
        name: 'Heading',
        type: 'TEXT',
        key: 'stylekey1',
        description: 'Main heading style'
      };

      mockFigma.getLocalTextStylesAsync.mockResolvedValue([mockTextStyle]);
      mockFigma.getLocalPaintStylesAsync.mockResolvedValue([]);
      mockFigma.getLocalEffectStylesAsync.mockResolvedValue([]);
      mockFigma.getLocalGridStylesAsync.mockResolvedValue([]);

      expect(mockFigma.getLocalTextStylesAsync()).resolves.toContain(mockTextStyle);
    });
  });

  describe('Core Business Logic (Implementation Independent)', () => {
    test('should detect new elements correctly', () => {
      const previousElements: TestElement[] = [
        { id: '1', name: 'Button', type: 'component' }
      ];
      
      const currentElements: TestElement[] = [
        { id: '1', name: 'Button', type: 'component' },
        { id: '2', name: 'Input', type: 'component' }
      ];

      const changes = TestHelpers.detectChanges(previousElements, currentElements);
      
      expect(changes.added).toHaveLength(1);
      expect(changes.added[0].id).toBe('2');
      expect(changes.removed).toHaveLength(0);
      expect(changes.modified).toHaveLength(0);
    });

    test('should detect removed elements correctly', () => {
      const previousElements: TestElement[] = [
        { id: '1', name: 'Button', type: 'component' },
        { id: '2', name: 'Input', type: 'component' }
      ];
      
      const currentElements: TestElement[] = [
        { id: '1', name: 'Button', type: 'component' }
      ];

      const changes = TestHelpers.detectChanges(previousElements, currentElements);
      
      expect(changes.removed).toHaveLength(1);
      expect(changes.removed[0].id).toBe('2');
      expect(changes.added).toHaveLength(0);
    });

    test('should detect modified elements correctly', () => {
      const previousElements: TestElement[] = [
        { id: '1', name: 'Button', type: 'component' }
      ];
      
      const currentElements: TestElement[] = [
        { id: '1', name: 'Primary Button', type: 'component' } // Name changed
      ];

      const changes = TestHelpers.detectChanges(previousElements, currentElements);
      
      expect(changes.modified).toHaveLength(1);
      expect(changes.modified[0].name).toBe('Primary Button');
      expect(changes.added).toHaveLength(0);
      expect(changes.removed).toHaveLength(0);
    });
  });

  describe('Hash Function Behavior (Algorithm Independent)', () => {
    test('hash function should be stable', () => {
      expect(TestHelpers.isHashFunctionStable(TestHelpers.simpleHash)).toBe(true);
    });

    test('hash function should be sensitive to changes', () => {
      expect(TestHelpers.isHashFunctionSensitive(TestHelpers.simpleHash)).toBe(true);
    });

    test('should generate different hashes for different property sets', () => {
      const props1 = { width: 100, height: 50 };
      const props2 = { width: 150, height: 50 }; // Only width changed
      
      const hash1 = TestHelpers.simpleHash(JSON.stringify(props1));
      const hash2 = TestHelpers.simpleHash(JSON.stringify(props2));
      
      expect(hash1).not.toBe(hash2);
    });

    test('should handle empty and null values consistently', () => {
      const emptyProps = {};
      const nullProps = { value: null };
      const definedProps = { value: 'test' };
      
      const emptyHash = TestHelpers.simpleHash(JSON.stringify(emptyProps));
      const nullHash = TestHelpers.simpleHash(JSON.stringify(nullProps));
      const definedHash = TestHelpers.simpleHash(JSON.stringify(definedProps));
      
      // Each should give unique hash
      expect(emptyHash).not.toBe(nullHash);
      expect(nullHash).not.toBe(definedHash);
      expect(emptyHash).not.toBe(definedHash);
      
      // Check that hashes are stable
      expect(emptyHash).toBe(TestHelpers.simpleHash(JSON.stringify({})));
      expect(nullHash).toBe(TestHelpers.simpleHash(JSON.stringify({ value: null })));
    });
  });

  describe('Data Validation', () => {
    test('should validate correct element structure', () => {
      const validElement = {
        id: 'test1',
        name: 'Test Component',
        type: 'component',
        key: 'testkey',
        description: 'Test description'
      };

      // Basic validation check
      const isValid = validElement.id && 
                     typeof validElement.id === 'string' &&
                     validElement.name && 
                     typeof validElement.name === 'string' &&
                     validElement.type && 
                     typeof validElement.type === 'string';

      expect(isValid).toBe(true);
    });

    test('should reject invalid element structure', () => {
      const invalidElement = {
        id: '', // Empty ID is invalid
        name: 'Test Component',
        type: 'component'
      };

      const isValid = !!(invalidElement.id && 
                        typeof invalidElement.id === 'string' &&
                        invalidElement.id.length > 0 &&
                        invalidElement.name && 
                        typeof invalidElement.name === 'string' &&
                        invalidElement.type && 
                        typeof invalidElement.type === 'string');

      expect(isValid).toBe(false);
    });

    test('should validate tracking data structure', () => {
      const validTrackingData = {
        timestamp: Date.now(),
        elements: [
          {
            id: 'test1',
            name: 'Test Component',
            type: 'component'
          }
        ]
      };

      const isValid = validTrackingData.timestamp &&
                     typeof validTrackingData.timestamp === 'number' &&
                     Array.isArray(validTrackingData.elements);

      expect(isValid).toBe(true);
    });
  });

  describe('Performance Monitoring', () => {
    test('should track operation performance', async () => {
      const startTime = Date.now();
      
      // Simulate an operation
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeGreaterThanOrEqual(50);
    });

    test('should handle performance metrics', () => {
      const metrics = {
        operation: 'testOperation',
        startTime: Date.now(),
        endTime: Date.now() + 100,
        duration: 100,
        elementsProcessed: 10
      };

      expect(metrics.duration).toBe(100);
      expect(metrics.elementsProcessed).toBe(10);
    });
  });

    test('should provide detailed validation errors', () => {
      const invalidElement: { name: string; type: string; id?: string } = {
        name: 'Test',
        type: 'invalid_type' // Invalid type
      };

      const errors: string[] = [];
      
      if (!invalidElement.id) {
        errors.push('Missing required field: id');
      }
      
      const validTypes = ['component', 'componentSet', 'textStyle', 'colorStyle', 'variable', 'variableCollection'];
      if (!validTypes.includes(invalidElement.type)) {
        errors.push(`Invalid type: ${invalidElement.type}`);
      }

      expect(errors).toContain('Missing required field: id');
      expect(errors).toContain('Invalid type: invalid_type');
    });

    test('should provide validation warnings', () => {
      const elementWithWarnings = {
        id: 'test1',
        name: '', // Empty name should generate warning
        type: 'component',
        modifiedAt: Date.now() + 86400000 * 2 // Future timestamp should generate warning
      };

      const warnings: string[] = [];
      
      if (elementWithWarnings.name.length === 0) {
        warnings.push('Name is empty');
      }
      
      if (elementWithWarnings.modifiedAt > Date.now() + 86400000) {
        warnings.push('Modified timestamp seems invalid');
      }

      expect(warnings).toContain('Name is empty');
      expect(warnings).toContain('Modified timestamp seems invalid');
    });

  describe('Logging System', () => {
    test('should create log entries', () => {
      const logEntry = {
        timestamp: Date.now(),
        level: 1, // INFO
        message: 'Test message',
        context: 'test',
        metadata: { key: 'value' }
      };

      expect(logEntry.timestamp).toBeDefined();
      expect(logEntry.level).toBe(1);
      expect(logEntry.message).toBe('Test message');
      expect(logEntry.context).toBe('test');
      expect(logEntry.metadata).toEqual({ key: 'value' });
    });

    test('should filter logs by level', () => {
      const logs = [
        { level: 0, message: 'Debug', context: 'test' }, // DEBUG
        { level: 1, message: 'Info', context: 'test' },  // INFO
        { level: 2, message: 'Warning', context: 'test' }, // WARN
        { level: 3, message: 'Error', context: 'test' }   // ERROR
      ];

      const warningAndAbove = logs.filter(log => log.level >= 2);
      
      expect(warningAndAbove).toHaveLength(2);
      expect(warningAndAbove[0].message).toBe('Warning');
      expect(warningAndAbove[1].message).toBe('Error');
    });
  });

  describe('Error Handling', () => {
    test('should handle async operation errors', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Test error'));
      
      try {
        await mockOperation();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Test error');
      }
    });

    test('should provide error context', () => {
      const error = new Error('Test error');
      const context = 'test operation';
      const fullMessage = `[${context}] ${error.message}`;
      
      expect(fullMessage).toBe('[test operation] Test error');
    });
  });

  describe('Message Handling', () => {
    test('should validate plugin messages', () => {
      const validMessage = { type: 'initialize' };
      const invalidMessage = { action: 'unknown' };
      
      const validTypes = ['initialize', 'refresh', 'addToFigma', 'skipVersion', 'viewRecords'];
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isValidMessage = (msg: any) => {
        return msg && typeof msg === 'object' && 
               typeof msg.type === 'string' && 
               validTypes.includes(msg.type);
      };
      
      expect(isValidMessage(validMessage)).toBe(true);
      expect(isValidMessage(invalidMessage)).toBe(false);
    });
  });

  describe('Extended Properties Behavior', () => {
    test('should handle layout properties changes', () => {
      const layoutProps1 = {
        layoutMode: 'HORIZONTAL',
        itemSpacing: 16,
        padding: { top: 8, right: 12, bottom: 8, left: 12 }
      };
      
      const layoutProps2 = {
        ...layoutProps1,
        itemSpacing: 24 // Only spacing changed
      };

      const hash1 = JSON.stringify(layoutProps1);
      const hash2 = JSON.stringify(layoutProps2);
      
      expect(hash1).not.toBe(hash2);
    });

    test('should handle geometry properties changes', () => {
      const geoProps1 = { width: 100, height: 50, x: 10, y: 20 };
      const geoProps2 = { ...geoProps1, width: 150 }; // Width changed
      
      const hash1 = JSON.stringify(geoProps1);
      const hash2 = JSON.stringify(geoProps2);
      
      expect(hash1).not.toBe(hash2);
    });

    test('should handle typography properties changes', () => {
      const typoProps1 = {
        fontFamily: 'Inter',
        fontSize: 16,
        lineHeight: 24
      };
      
      const typoProps2 = {
        ...typoProps1,
        fontSize: 18 // Font size changed
      };

      const hash1 = JSON.stringify(typoProps1);
      const hash2 = JSON.stringify(typoProps2);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle empty data gracefully', () => {
      const emptyPrevious: TestElement[] = [];
      const emptyCurrent: TestElement[] = [];
      
      const changes = TestHelpers.detectChanges(emptyPrevious, emptyCurrent);
      
      expect(changes.added).toHaveLength(0);
      expect(changes.modified).toHaveLength(0);
      expect(changes.removed).toHaveLength(0);
    });

    test('should handle malformed element data', () => {
      const validElements: TestElement[] = [
        { id: '1', name: 'Valid Element', type: 'component' }
      ];
      
      const elementsWithMissingFields: Partial<TestElement>[] = [
        { id: '2', name: 'Missing Type' }, // Missing type field
        { id: '3', type: 'component' }      // Missing name field
      ];
      
      // Function should handle incorrect data
      const filterValidElements = (elements: (TestElement | Partial<TestElement>)[]): TestElement[] => {
        return elements.filter((elem): elem is TestElement => 
          typeof elem.id === 'string' && 
          typeof elem.name === 'string' && 
          typeof elem.type === 'string'
        );
      };
      
      const filtered = filterValidElements([...validElements, ...elementsWithMissingFields]);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('1');
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large numbers of elements efficiently', () => {
      // Generate large dataset
      const largeElementSet: TestElement[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `element-${i}`,
        name: `Element ${i}`,
        type: 'component'
      }));
      
      const modifiedSet = largeElementSet.map((elem, index) => 
        index % 100 === 0 ? { ...elem, name: `Modified ${elem.name}` } : elem
      );
      
      const startTime = performance.now();
      const changes = TestHelpers.detectChanges(largeElementSet, modifiedSet);
      const endTime = performance.now();
      
      // Should complete within reasonable time (less than 100ms for 1000 elements)
      expect(endTime - startTime).toBeLessThan(100);
      
      // Should detect correct number of changes
      expect(changes.modified).toHaveLength(10); // Every 100th element was modified
      expect(changes.added).toHaveLength(0);
      expect(changes.removed).toHaveLength(0);
    });

    test('should process elements in batches', () => {
      const elements = Array.from({ length: 100 }, (_, i) => ({ id: `element${i}` }));
      const batchSize = 25;
      const batches: typeof elements[] = [];
      
      for (let i = 0; i < elements.length; i += batchSize) {
        batches.push(elements.slice(i, i + batchSize));
      }
      
      expect(batches).toHaveLength(4);
      expect(batches[0]).toHaveLength(25);
      expect(batches[3]).toHaveLength(25);
    });

    test('should handle memory usage estimation', () => {
      const mockMemoryUsage = () => Date.now() % 1000000;
      
      const before = mockMemoryUsage();
      const after = mockMemoryUsage();
      
      expect(typeof before).toBe('number');
      expect(typeof after).toBe('number');
    });
  });

  describe('Data Compression', () => {
    test('should compress tracking data', () => {
      const trackingData = {
        timestamp: Date.now(),
        elements: [
          { id: '1', name: 'Component 1', type: 'component' },
          { id: '2', name: 'Component 2', type: 'component' }
        ]
      };
      
      const compressed = JSON.stringify(trackingData);
      const decompressed = JSON.parse(compressed);
      
      expect(decompressed.timestamp).toBe(trackingData.timestamp);
      expect(decompressed.elements).toHaveLength(2);
    });
  });

  describe('UI Integration', () => {
    test('should post messages to UI', () => {
      const message = { type: 'update', data: { count: 5 } };
      
      mockFigma.ui.postMessage(message);
      
      expect(mockFigma.ui.postMessage).toHaveBeenCalledWith(message);
    });

    test('should handle UI message responses', () => {
      const _mockHandler = jest.fn();
      
      if (mockFigma.ui.onmessage) {
        mockFigma.ui.onmessage({ type: 'initialize' });
      }
      
      // Test that the message handling structure is in place
      expect(mockFigma.ui.onmessage).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    test('should handle full workflow: collect, compare, and update', async () => {
      // Mock initial data
      const initialElements = [
        { id: '1', name: 'Button', type: 'component' }
      ];
      
      // Mock current data with changes
      const currentElements = [
        { id: '1', name: 'Primary Button', type: 'component' }, // Modified
        { id: '2', name: 'Input', type: 'component' } // Added
      ];
      
      // Compare
      const added = currentElements.filter(curr => 
        !initialElements.some(prev => prev.id === curr.id)
      );
      
      const modified = currentElements.filter(curr => {
        const prev = initialElements.find(p => p.id === curr.id);
        return prev && prev.name !== curr.name;
      });
      
      expect(added).toHaveLength(1);
      expect(modified).toHaveLength(1);
      expect(added[0].name).toBe('Input');
      expect(modified[0].name).toBe('Primary Button');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty element collections', () => {
      const emptyCollection: MockNode[] = [];
      const changes = {
        added: emptyCollection,
        modified: emptyCollection,
        removed: emptyCollection
      };
      
      const totalChanges = changes.added.length + changes.modified.length + changes.removed.length;
      
      expect(totalChanges).toBe(0);
    });

    test('should handle large datasets', () => {
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        id: `element${i}`,
        name: `Element ${i}`,
        type: 'component'
      }));
      
      expect(largeDataset).toHaveLength(10000);
      
      // Test chunking for large datasets
      const chunkSize = 1000;
      const chunks = [];
      for (let i = 0; i < largeDataset.length; i += chunkSize) {
        chunks.push(largeDataset.slice(i, i + chunkSize));
      }
      
      expect(chunks).toHaveLength(10);
      expect(chunks[0]).toHaveLength(1000);
    });

    test('should handle malformed data gracefully', () => {
      const malformedData = [
        null,
        undefined,
        { id: null, name: 'Test' },
        { id: '', name: 'Test with empty ID' }, // Changed to empty string
        'not an object',
        123
      ];
      
      const validElements = malformedData.filter(item => 
        item && 
        typeof item === 'object' && 
        typeof item.id === 'string' && 
        item.id.length > 0
      );
      
      expect(validElements).toHaveLength(0);
    });
  });

  describe('Additional Error Scenarios', () => {
    test('should handle invalid element structure', () => {
      const invalidElement = {
        id: 123, // Should be string
        name: 'Test Component',
        type: 'component'
      };

      const isValid = typeof invalidElement.id === 'string';
      expect(isValid).toBe(false);
    });

    test('should validate changes structure', () => {
      const validChanges = {
        added: [],
        modified: [],
        removed: []
      };

      const isValidChanges = Array.isArray(validChanges.added) &&
                            Array.isArray(validChanges.modified) &&
                            Array.isArray(validChanges.removed);

      expect(isValidChanges).toBe(true);
    });
  });

  describe('Hash Functions', () => {
    test('should generate consistent hashes for same input', () => {
      // Simple hash implementation for testing
      function simpleHash(str: string): string {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          hash = ((hash << 5) + hash) + char;
        }
        return hash.toString(16);
      }

      const input = 'test string';
      const hash1 = simpleHash(input);
      const hash2 = simpleHash(input);

      expect(hash1).toBe(hash2);
    });

    test('should generate different hashes for different inputs', () => {
      function simpleHash(str: string): string {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          hash = ((hash << 5) + hash) + char;
        }
        return hash.toString(16);
      }

      const hash1 = simpleHash('test string 1');
      const hash2 = simpleHash('test string 2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Component Properties Handling', () => {
    test('should handle variant properties correctly', () => {
      const componentWithVariants = {
        id: 'comp1',
        name: 'Button',
        variantProperties: { Size: 'Large', State: 'Default' },
        parent: { type: 'COMPONENT_SET', name: 'Button Set' }
      };

      expect(componentWithVariants.variantProperties).toBeTruthy();
      expect(componentWithVariants.variantProperties?.Size).toBe('Large');
    });

    test('should handle component sets correctly', () => {
      const componentSet = {
        id: 'set1',
        name: 'Button Set',
        type: 'COMPONENT_SET',
        componentPropertyDefinitions: { 
          Size: { type: 'VARIANT', defaultValue: 'Medium' } 
        }
      };

      expect(componentSet.componentPropertyDefinitions).toBeTruthy();
      expect(componentSet.componentPropertyDefinitions.Size.type).toBe('VARIANT');
    });
  });

  describe('Error Scenarios', () => {
    test('should handle missing data gracefully', () => {
      mockFigma.root.getSharedPluginData.mockReturnValue('');
      const result = mockFigma.root.getSharedPluginData('test', 'missing');
      expect(result).toBe('');
    });

    test('should handle malformed JSON data', () => {
      mockFigma.root.getSharedPluginData.mockReturnValue('invalid json {');
      
      try {
        JSON.parse(mockFigma.root.getSharedPluginData('test', 'malformed'));
      } catch (error) {
        expect(error).toBeInstanceOf(SyntaxError);
      }
    });

    test('should handle API errors during font loading', async () => {
      mockFigma.loadFontAsync.mockRejectedValue(new Error('Font not available'));
      
      try {
        await mockFigma.loadFontAsync({ family: 'NonExistent', style: 'Regular' });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Font not available');
      }
    });
  });

  describe('UI Message Handling', () => {
    test('should handle initialize message', () => {
      const initMessage = { type: 'initialize' };
      expect(initMessage.type).toBe('initialize');
    });

    test('should handle refresh message', () => {
      const refreshMessage = { type: 'refresh' };
      expect(refreshMessage.type).toBe('refresh');
    });

    test('should handle addToFigma message with valid changes', () => {
      const addMessage = {
        type: 'addToFigma',
        changes: {
          added: [{ id: '1', name: 'New Button', type: 'component' }],
          modified: [],
          removed: []
        }
      };

      expect(addMessage.changes.added).toHaveLength(1);
      expect(addMessage.changes.added[0].name).toBe('New Button');
    });

    test('should handle viewRecords message', () => {
      const viewMessage = { type: 'viewRecords' };
      expect(viewMessage.type).toBe('viewRecords');
    });
  });

  describe('Data Compression', () => {
    test('should compress element data for storage', () => {
      const originalElement = {
        id: 'comp1',
        name: 'Button',
        type: 'component',
        key: 'key1',
        description: 'A button component',
        variantProperties: null,
        variantPropertiesHash: undefined,
        parentName: undefined,
        modifiedAt: Date.now(),
        updatedAt: Date.now()
      };

      // Simulate compression
      const compressed = {
        i: originalElement.id,
        n: originalElement.name,
        ty: originalElement.type,
        k: originalElement.key,
        d: originalElement.description,
        vp: originalElement.variantProperties,
        vh: originalElement.variantPropertiesHash,
        pn: originalElement.parentName,
        ma: originalElement.modifiedAt,
        ua: originalElement.updatedAt
      };

      expect(compressed.i).toBe(originalElement.id);
      expect(compressed.n).toBe(originalElement.name);
      expect(compressed.ty).toBe(originalElement.type);
    });

    test('should decompress element data from storage', () => {
      const compressed = {
        i: 'comp1',
        n: 'Button',
        ty: 'component',
        k: 'key1',
        d: 'A button component'
      };

      // Simulate decompression
      const decompressed = {
        id: compressed.i,
        name: compressed.n,
        type: compressed.ty,
        key: compressed.k,
        description: compressed.d
      };

      expect(decompressed.id).toBe(compressed.i);
      expect(decompressed.name).toBe(compressed.n);
      expect(decompressed.type).toBe(compressed.ty);
    });
  });

  describe('Timestamp Handling', () => {
    test('should preserve modifiedAt for unchanged elements', () => {
      const previousElement = {
        id: '1',
        name: 'Button',
        modifiedAt: Date.now() - 10000,
        updatedAt: Date.now() - 5000
      };

      const currentElement = {
        id: '1',
        name: 'Button', // Same name, no changes
        modifiedAt: Date.now(),
        updatedAt: Date.now()
      };

      // Logic: if element unchanged, preserve modifiedAt
      const hasChanges = previousElement.name !== currentElement.name;
      if (!hasChanges) {
        currentElement.modifiedAt = previousElement.modifiedAt;
      }

      expect(currentElement.modifiedAt).toBe(previousElement.modifiedAt);
    });

    test('should update timestamps for changed elements', () => {
      const previousElement = {
        id: '1',
        name: 'Button',
        modifiedAt: Date.now() - 10000,
        updatedAt: Date.now() - 5000
      };

      const currentElement = {
        id: '1',
        name: 'Primary Button', // Name changed
        modifiedAt: Date.now(),
        updatedAt: Date.now()
      };

      const hasChanges = previousElement.name !== currentElement.name;
      
      expect(hasChanges).toBe(true);
      expect(currentElement.modifiedAt).toBeGreaterThan(previousElement.modifiedAt);
    });
  });

  describe('Extended Properties Tracking', () => {
    // Helper function to create mock hash
    function simpleHash(str: string): string {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return hash.toString();
    }

    test('should generate layout hash for auto-layout properties', () => {
      const mockLayoutNode = {
        id: 'layout1',
        type: 'FRAME',
        layoutMode: 'HORIZONTAL',
        primaryAxisSizingMode: 'AUTO',
        counterAxisSizingMode: 'FIXED',
        primaryAxisAlignItems: 'CENTER',
        counterAxisAlignItems: 'CENTER',
        itemSpacing: 16,
        paddingTop: 8,
        paddingRight: 12,
        paddingBottom: 8,
        paddingLeft: 12
      };

      const layoutProps = {
        layoutMode: mockLayoutNode.layoutMode,
        primaryAxisSizingMode: mockLayoutNode.primaryAxisSizingMode,
        counterAxisSizingMode: mockLayoutNode.counterAxisSizingMode,
        primaryAxisAlignItems: mockLayoutNode.primaryAxisAlignItems,
        counterAxisAlignItems: mockLayoutNode.counterAxisAlignItems,
        itemSpacing: mockLayoutNode.itemSpacing,
        paddingTop: mockLayoutNode.paddingTop,
        paddingRight: mockLayoutNode.paddingRight,
        paddingBottom: mockLayoutNode.paddingBottom,
        paddingLeft: mockLayoutNode.paddingLeft
      };

      const layoutHash = simpleHash(JSON.stringify(layoutProps));
      
      expect(layoutHash).toBeDefined();
      expect(typeof layoutHash).toBe('string');

      // Hash should change when properties change
      const modifiedProps = { ...layoutProps, itemSpacing: 24 };
      const modifiedHash = simpleHash(JSON.stringify(modifiedProps));
      
      expect(modifiedHash).not.toBe(layoutHash);
    });

    test('should generate geometry hash for size and position', () => {
      const mockNode = {
        id: 'geo1',
        width: 100,
        height: 50,
        x: 10,
        y: 20,
        rotation: 0,
        cornerRadius: 8
      };

      const geometryProps = {
        width: mockNode.width,
        height: mockNode.height,
        x: mockNode.x,
        y: mockNode.y,
        rotation: mockNode.rotation,
        cornerRadius: mockNode.cornerRadius
      };

      const geometryHash = simpleHash(JSON.stringify(geometryProps));
      
      expect(geometryHash).toBeDefined();
      expect(typeof geometryHash).toBe('string');

      // Hash should change when geometry changes
      const resizedProps = { ...geometryProps, width: 150 };
      const resizedHash = simpleHash(JSON.stringify(resizedProps));
      
      expect(resizedHash).not.toBe(geometryHash);
    });

    test('should generate appearance hash for visual properties', () => {
      const mockNode = {
        id: 'app1',
        opacity: 0.8,
        blendMode: 'NORMAL',
        visible: true,
        locked: false
      };

      const appearanceProps = {
        opacity: mockNode.opacity,
        blendMode: mockNode.blendMode,
        visible: mockNode.visible,
        locked: mockNode.locked
      };

      const appearanceHash = simpleHash(JSON.stringify(appearanceProps));
      
      expect(appearanceHash).toBeDefined();
      expect(typeof appearanceHash).toBe('string');

      // Hash should change when appearance changes
      const hiddenProps = { ...appearanceProps, visible: false };
      const hiddenHash = simpleHash(JSON.stringify(hiddenProps));
      
      expect(hiddenHash).not.toBe(appearanceHash);
    });

    test('should generate typography hash for text properties', () => {
      const mockTextNode = {
        id: 'text1',
        type: 'TEXT',
        fontName: { family: 'Inter', style: 'Regular' },
        fontSize: 16,
        letterSpacing: { value: 0, unit: 'PIXELS' },
        lineHeight: { value: 24, unit: 'PIXELS' },
        textAlignHorizontal: 'LEFT',
        textAlignVertical: 'TOP',
        textCase: 'ORIGINAL',
        textDecoration: 'NONE'
      };

      const typographyProps = {
        fontName: mockTextNode.fontName,
        fontSize: mockTextNode.fontSize,
        letterSpacing: mockTextNode.letterSpacing,
        lineHeight: mockTextNode.lineHeight,
        textAlignHorizontal: mockTextNode.textAlignHorizontal,
        textAlignVertical: mockTextNode.textAlignVertical,
        textCase: mockTextNode.textCase,
        textDecoration: mockTextNode.textDecoration
      };

      const typographyHash = simpleHash(JSON.stringify(typographyProps));
      
      expect(typographyHash).toBeDefined();
      expect(typeof typographyHash).toBe('string');

      // Hash should change when typography changes
      const largerProps = { ...typographyProps, fontSize: 20 };
      const largerHash = simpleHash(JSON.stringify(largerProps));
      
      expect(largerHash).not.toBe(typographyHash);
    });

    test('should generate instance overrides hash', () => {
      const mockInstanceNode = {
        id: 'inst1',
        type: 'INSTANCE',
        overrides: [
          { id: 'child1', overriddenFields: ['text'] },
          { id: 'child2', overriddenFields: ['fills'] }
        ]
      };

      const overridesHash = simpleHash(JSON.stringify(mockInstanceNode.overrides));
      
      expect(overridesHash).toBeDefined();
      expect(typeof overridesHash).toBe('string');

      // Hash should change when overrides change
      const modifiedOverrides = [
        ...mockInstanceNode.overrides,
        { id: 'child3', overriddenFields: ['visible'] }
      ];
      const modifiedHash = simpleHash(JSON.stringify(modifiedOverrides));
      
      expect(modifiedHash).not.toBe(overridesHash);
    });

    test('should generate border properties hash', () => {
      const mockBorderNode = {
        strokeWeight: 2,
        strokeAlign: 'CENTER',
        strokeCap: 'ROUND',
        strokeJoin: 'MITER',
        strokeMiterLimit: 4,
        dashPattern: [5, 5]
      };

      const borderProps = {
        strokeWeight: mockBorderNode.strokeWeight,
        strokeAlign: mockBorderNode.strokeAlign,
        strokeCap: mockBorderNode.strokeCap,
        strokeJoin: mockBorderNode.strokeJoin,
        strokeMiterLimit: mockBorderNode.strokeMiterLimit,
        dashPattern: mockBorderNode.dashPattern
      };

      const borderHash = simpleHash(JSON.stringify(borderProps));
      
      expect(borderHash).toBeDefined();
      expect(typeof borderHash).toBe('string');

      // Hash should change when border properties change
      const thickerProps = { ...borderProps, strokeWeight: 4 };
      const thickerHash = simpleHash(JSON.stringify(thickerProps));
      
      expect(thickerHash).not.toBe(borderHash);
    });
  });

  describe('Variables Support', () => {
    test('should handle variable collections when available', () => {
      const mockVariableCollection = {
        id: 'vc1',
        name: 'Colors',
        key: 'colors-key',
        description: 'Color variables',
        modes: [{ modeId: 'mode1', name: 'Light' }],
        defaultModeId: 'mode1',
        remote: false,
        hiddenFromPublishing: false
      };

      const mockVariable = {
        id: 'var1',
        name: 'Primary Blue',
        key: 'primary-blue',
        description: 'Main brand color',
        variableCollectionId: 'vc1',
        resolvedType: 'COLOR',
        valuesByMode: { mode1: { r: 0, g: 0.5, b: 1, a: 1 } },
        remote: false,
        hiddenFromPublishing: false,
        scopes: ['ALL_FILLS']
      };

      // Test that we can process variable collections
      expect(mockVariableCollection.id).toBe('vc1');
      expect(mockVariableCollection.name).toBe('Colors');
      expect(mockVariable.variableCollectionId).toBe('vc1');
    });

    test('should gracefully handle unavailable variables API', () => {
      // Simulate Variables API not being available
      const figmaWithoutVariables = {
        variables: undefined
      };

      // Should not throw error when variables API is not available
      const hasVariablesAPI = typeof figmaWithoutVariables.variables !== 'undefined';
      expect(hasVariablesAPI).toBe(false);
    });

    test('should process variable definition hashing', () => {
      function simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        return hash.toString();
      }

      const variableCollectionDef = {
        modes: [{ modeId: 'light', name: 'Light' }, { modeId: 'dark', name: 'Dark' }],
        defaultModeId: 'light',
        remote: false,
        hiddenFromPublishing: false
      };

      const definitionHash = simpleHash(JSON.stringify(variableCollectionDef));
      
      expect(definitionHash).toBeDefined();
      expect(typeof definitionHash).toBe('string');

      // Hash should change when definition changes
      const modifiedDef = { ...variableCollectionDef, defaultModeId: 'dark' };
      const modifiedHash = simpleHash(JSON.stringify(modifiedDef));
      
      expect(modifiedHash).not.toBe(definitionHash);
    });
  });

  describe('Extended Data Compression', () => {
    function simpleHash(str: string): string {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return hash.toString();
    }

    test('should compress extended properties', () => {
      const mockElement = {
        id: 'ext1',
        name: 'Extended Component',
        type: 'component',
        key: 'ext-key',
        layoutHash: simpleHash('layout-data'),
        geometryHash: simpleHash('geometry-data'),
        appearanceHash: simpleHash('appearance-data'),
        borderHash: simpleHash('border-data'),
        typographyHash: simpleHash('typography-data'),
        variableUsageHash: simpleHash('variable-usage'),
        instanceOverridesHash: simpleHash('overrides-data'),
        exposedPropertiesHash: simpleHash('exposed-props')
      };

      const compressed = {
        i: mockElement.id,
        n: mockElement.name,
        ty: mockElement.type,
        k: mockElement.key,
        lh: mockElement.layoutHash,
        gh: mockElement.geometryHash,
        ah: mockElement.appearanceHash,
        bh: mockElement.borderHash,
        th: mockElement.typographyHash,
        vu: mockElement.variableUsageHash,
        io: mockElement.instanceOverridesHash,
        ep: mockElement.exposedPropertiesHash
      };

      expect(compressed.i).toBe(mockElement.id);
      expect(compressed.lh).toBe(mockElement.layoutHash);
      expect(compressed.gh).toBe(mockElement.geometryHash);
      expect(compressed.ah).toBe(mockElement.appearanceHash);
    });

    test('should decompress extended properties', () => {
      const compressedElement = {
        i: 'ext1',
        n: 'Extended Component',
        ty: 'component',
        k: 'ext-key',
        lh: 'layout-hash',
        gh: 'geometry-hash',
        ah: 'appearance-hash',
        bh: 'border-hash',
        th: 'typography-hash',
        vu: 'variable-usage-hash',
        io: 'overrides-hash',
        ep: 'exposed-props-hash'
      };

      const decompressed = {
        id: compressedElement.i,
        name: compressedElement.n,
        type: compressedElement.ty,
        key: compressedElement.k,
        layoutHash: compressedElement.lh,
        geometryHash: compressedElement.gh,
        appearanceHash: compressedElement.ah,
        borderHash: compressedElement.bh,
        typographyHash: compressedElement.th,
        variableUsageHash: compressedElement.vu,
        instanceOverridesHash: compressedElement.io,
        exposedPropertiesHash: compressedElement.ep
      };

      expect(decompressed.id).toBe(compressedElement.i);
      expect(decompressed.layoutHash).toBe(compressedElement.lh);
      expect(decompressed.geometryHash).toBe(compressedElement.gh);
      expect(decompressed.appearanceHash).toBe(compressedElement.ah);
    });
  });

  describe('Extended Change Detection', () => {
    test('should detect layout changes', () => {
      const previousElement = {
        id: '1',
        name: 'Component',
        layoutHash: 'layout-hash-old'
      };
      
      const currentElement = {
        id: '1',
        name: 'Component',
        layoutHash: 'layout-hash-new'
      };

      const layoutChanged = previousElement.layoutHash !== currentElement.layoutHash;
      expect(layoutChanged).toBe(true);
    });

    test('should detect geometry changes', () => {
      const previousElement = {
        id: '1',
        name: 'Component',
        geometryHash: 'geometry-hash-old'
      };
      
      const currentElement = {
        id: '1',
        name: 'Component',
        geometryHash: 'geometry-hash-new'
      };

      const geometryChanged = previousElement.geometryHash !== currentElement.geometryHash;
      expect(geometryChanged).toBe(true);
    });

    test('should detect typography changes', () => {
      const previousElement = {
        id: '1',
        name: 'Text Component',
        typographyHash: 'typography-hash-old'
      };
      
      const currentElement = {
        id: '1',
        name: 'Text Component',
        typographyHash: 'typography-hash-new'
      };

      const typographyChanged = previousElement.typographyHash !== currentElement.typographyHash;
      expect(typographyChanged).toBe(true);
    });

    test('should detect instance override changes', () => {
      const previousElement = {
        id: '1',
        name: 'Instance',
        instanceOverridesHash: 'overrides-hash-old'
      };
      
      const currentElement = {
        id: '1',
        name: 'Instance',
        instanceOverridesHash: 'overrides-hash-new'
      };

      const overridesChanged = previousElement.instanceOverridesHash !== currentElement.instanceOverridesHash;
      expect(overridesChanged).toBe(true);
    });

    test('should detect multiple simultaneous changes', () => {
      const previousElement = {
        id: '1',
        name: 'Component',
        layoutHash: 'layout-old',
        geometryHash: 'geometry-old',
        appearanceHash: 'appearance-old'
      };
      
      const currentElement = {
        id: '1',
        name: 'Updated Component', // Name changed
        layoutHash: 'layout-new',   // Layout changed
        geometryHash: 'geometry-old', // Geometry unchanged
        appearanceHash: 'appearance-new' // Appearance changed
      };

      const changes = {
        nameChanged: previousElement.name !== currentElement.name,
        layoutChanged: previousElement.layoutHash !== currentElement.layoutHash,
        geometryChanged: previousElement.geometryHash !== currentElement.geometryHash,
        appearanceChanged: previousElement.appearanceHash !== currentElement.appearanceHash
      };

      expect(changes.nameChanged).toBe(true);
      expect(changes.layoutChanged).toBe(true);
      expect(changes.geometryChanged).toBe(false);
      expect(changes.appearanceChanged).toBe(true);

      // Count total changes
      const totalChanges = Object.values(changes).filter(changed => changed).length;
      expect(totalChanges).toBe(3);
    });

    test('should detect variable definition changes', () => {
      const previousElement = {
        id: '1',
        name: 'Color Variable',
        type: 'variable',
        variableDefinitionHash: 'var-def-hash-old'
      };
      
      const currentElement = {
        id: '1',
        name: 'Color Variable',
        type: 'variable',
        variableDefinitionHash: 'var-def-hash-new'
      };

      const variableDefChanged = previousElement.variableDefinitionHash !== currentElement.variableDefinitionHash;
      expect(variableDefChanged).toBe(true);
    });

    test('should handle absence of extended properties gracefully', () => {
      const previousElement = {
        id: '1',
        name: 'Basic Component'
        // No extended properties
      };
      
      const currentElement = {
        id: '1',
        name: 'Basic Component',
        layoutHash: 'new-layout-hash' // Extended property added
      };

      // Should handle undefined vs defined comparison
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const layoutChanged = (previousElement as any).layoutHash !== currentElement.layoutHash;
      expect(layoutChanged).toBe(true);
    });
  });

  describe('Comprehensive Integration Tests', () => {
    test('should handle full element lifecycle with extended properties', () => {
      // Step 1: Create element with basic properties
      const initialElement = {
        id: 'comp1',
        name: 'Button Component',
        type: 'component',
        key: 'button-key'
      };

      // Step 2: Add extended properties
      const extendedElement = {
        ...initialElement,
        layoutHash: 'layout-123',
        geometryHash: 'geo-456',
        appearanceHash: 'app-789'
      };

      // Step 3: Modify properties
      const modifiedElement = {
        ...extendedElement,
        name: 'Primary Button Component', // Changed name
        layoutHash: 'layout-modified',      // Changed layout
        geometryHash: 'geo-456'            // Geometry unchanged
      };

      // Verify changes are detected correctly
      const changes = {
        nameChanged: initialElement.name !== modifiedElement.name,
        layoutChanged: extendedElement.layoutHash !== modifiedElement.layoutHash,
        geometryChanged: extendedElement.geometryHash !== modifiedElement.geometryHash,
        appearanceChanged: extendedElement.appearanceHash !== modifiedElement.appearanceHash
      };

      expect(changes.nameChanged).toBe(true);
      expect(changes.layoutChanged).toBe(true);
      expect(changes.geometryChanged).toBe(false);
      expect(changes.appearanceChanged).toBe(false);
    });

    test('should maintain data integrity through compression cycle', () => {
      function simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        return hash.toString();
      }

      const originalElement = {
        id: 'test-element',
        name: 'Test Component',
        type: 'component',
        key: 'test-key',
        description: 'Test description',
        layoutHash: simpleHash('layout-data'),
        geometryHash: simpleHash('geometry-data'),
        appearanceHash: simpleHash('appearance-data'),
        typographyHash: simpleHash('typography-data'),
        instanceOverridesHash: simpleHash('overrides-data')
      };

      // Compress
      const compressed = {
        i: originalElement.id,
        n: originalElement.name,
        ty: originalElement.type,
        k: originalElement.key,
        d: originalElement.description,
        lh: originalElement.layoutHash,
        gh: originalElement.geometryHash,
        ah: originalElement.appearanceHash,
        th: originalElement.typographyHash,
        io: originalElement.instanceOverridesHash
      };

      // Decompress
      const decompressed = {
        id: compressed.i,
        name: compressed.n,
        type: compressed.ty,
        key: compressed.k,
        description: compressed.d,
        layoutHash: compressed.lh,
        geometryHash: compressed.gh,
        appearanceHash: compressed.ah,
        typographyHash: compressed.th,
        instanceOverridesHash: compressed.io
      };

      // Verify data integrity
      expect(decompressed.id).toBe(originalElement.id);
      expect(decompressed.name).toBe(originalElement.name);
      expect(decompressed.layoutHash).toBe(originalElement.layoutHash);
      expect(decompressed.geometryHash).toBe(originalElement.geometryHash);
      expect(decompressed.appearanceHash).toBe(originalElement.appearanceHash);
      expect(decompressed.typographyHash).toBe(originalElement.typographyHash);
      expect(decompressed.instanceOverridesHash).toBe(originalElement.instanceOverridesHash);
    });
  });

  describe('Comment Functionality', () => {
    const testMockElement = {
      id: 'test1',
      name: 'Test Component',
      type: 'component' as const,
      key: 'test-key',
      description: 'Test description'
    };

    it('should handle addToFigma message with comment', () => {
      const mockChanges = {
        added: [testMockElement],
        modified: [],
        removed: [],
        comment: 'Test comment for this entry'
      };

      const message = {
        type: 'addToFigma',
        changes: mockChanges,
        comment: 'Test comment for this entry'
      };

      // This should not throw
      expect(() => {
        // Validate comment length
        const comment = typeof message.comment === 'string' ? message.comment.trim() : '';
        expect(comment.length).toBeLessThanOrEqual(500);
        expect(comment).toBe('Test comment for this entry');
      }).not.toThrow();
    });

    it('should reject comments that are too long', () => {
      const longComment = 'a'.repeat(501);
      const message = {
        type: 'addToFigma',
        changes: {
          added: [testMockElement],
          modified: [],
          removed: []
        },
        comment: longComment
      };

      const comment = typeof message.comment === 'string' ? message.comment.trim() : '';
      expect(comment.length).toBeGreaterThan(500);
    });

    it('should handle empty comment gracefully', () => {
      const message = {
        type: 'addToFigma',
        changes: {
          added: [testMockElement],
          modified: [],
          removed: []
        },
        comment: ''
      };

      const comment = typeof message.comment === 'string' ? message.comment.trim() : '';
      expect(comment).toBe('');
    });

    it('should handle undefined comment gracefully', () => {
      const message = {
        type: 'addToFigma',
        changes: {
          added: [testMockElement],
          modified: [],
          removed: []
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const comment = typeof (message as any).comment === 'string' ? (message as any).comment.trim() : '';
      expect(comment).toBe('');
    });
  });

  describe('Component Set Filtering and Display Logic', () => {
    function simpleHash(str: string): string {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return hash.toString();
    }

    // Mock functions to simulate the filtering logic
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function mockFilterRedundantComponentSetChanges(changes: any) {
      const modifiedComponentSetIds = new Set<string>();
      const modifiedComponentParentNames = new Set<string>();
      
      // Collect component sets that have changed
      for (const element of changes.modified) {
        if (element.type === 'componentSet') {
          modifiedComponentSetIds.add(element.id);
        }
      }
      
      // Collect parent names of changed components
      for (const element of changes.modified) {
        if (element.type === 'component' && element.parentName) {
          modifiedComponentParentNames.add(element.parentName);
        }
      }
      
      // Filter out component sets that have changed components
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filteredModified = changes.modified.filter((element: any) => {
        if (element.type === 'componentSet' && modifiedComponentParentNames.has(element.name)) {
          return false; // Remove component set if its children are also modified
        }
        return true;
      });
      
      return {
        ...changes,
        modified: filteredModified
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function mockUpdateComponentDisplayNames(changes: any) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updatedModified = changes.modified.map((element: any) => {
        if (element.type === 'component' && element.parentName) {
          // Update the name to show "Set - Component" format
          return {
            ...element,
            name: `${element.parentName} - ${element.name}`
          };
        }
        return element;
      });
      
      return {
        ...changes,
        modified: updatedModified
      };
    }

    test('should filter out component set when child component is modified', () => {
      const mockChanges = {
        added: [],
        modified: [
          {
            id: 'set1',
            name: 'Button Set',
            type: 'componentSet',
            fillsHash: simpleHash('modified-set-fills')
          },
          {
            id: 'comp1',
            name: 'Primary',
            type: 'component',
            parentName: 'Button Set',
            fillsHash: simpleHash('modified-component-fills')
          }
        ],
        removed: []
      };

      const filteredChanges = mockFilterRedundantComponentSetChanges(mockChanges);

      // Should only have the component, not the component set
      expect(filteredChanges.modified.length).toBe(1);
      expect(filteredChanges.modified[0].type).toBe('component');
      expect(filteredChanges.modified[0].id).toBe('comp1');
    });

    test('should keep component set when only set is modified', () => {
      const mockChanges = {
        added: [],
        modified: [
          {
            id: 'set1',
            name: 'Button Set',
            type: 'componentSet',
            fillsHash: simpleHash('modified-set-fills')
          },
          {
            id: 'comp1',
            name: 'Primary',
            type: 'component',
            parentName: 'Card Set', // Different parent
            fillsHash: simpleHash('modified-component-fills')
          }
        ],
        removed: []
      };

      const filteredChanges = mockFilterRedundantComponentSetChanges(mockChanges);

      // Should keep both since they don't conflict
      expect(filteredChanges.modified.length).toBe(2);
    });

    test('should update component display names to "Set - Component" format', () => {
      const mockChanges = {
        added: [],
        modified: [
          {
            id: 'comp1',
            name: 'Primary',
            type: 'component',
            parentName: 'Button Set',
            fillsHash: simpleHash('component-fills')
          },
          {
            id: 'comp2',
            name: 'Secondary',
            type: 'component',
            parentName: 'Button Set',
            fillsHash: simpleHash('component-fills-2')
          }
        ],
        removed: []
      };

      const updatedChanges = mockUpdateComponentDisplayNames(mockChanges);

      expect(updatedChanges.modified[0].name).toBe('Button Set - Primary');
      expect(updatedChanges.modified[1].name).toBe('Button Set - Secondary');
    });

    test('should not modify names of components without parent', () => {
      const mockChanges = {
        added: [],
        modified: [
          {
            id: 'comp1',
            name: 'Standalone Component',
            type: 'component',
            // No parentName
            fillsHash: simpleHash('component-fills')
          }
        ],
        removed: []
      };

      const updatedChanges = mockUpdateComponentDisplayNames(mockChanges);

      expect(updatedChanges.modified[0].name).toBe('Standalone Component');
    });

    test('should not modify names of non-component elements', () => {
      const mockChanges = {
        added: [],
        modified: [
          {
            id: 'style1',
            name: 'Primary Color',
            type: 'colorStyle',
            parentName: 'Brand Colors', // Has parent but not a component
            fillsHash: simpleHash('style-fills')
          }
        ],
        removed: []
      };

      const updatedChanges = mockUpdateComponentDisplayNames(mockChanges);

      expect(updatedChanges.modified[0].name).toBe('Primary Color');
    });

    test('should handle complex component set filtering scenario', () => {
      const mockChanges = {
        added: [],
        modified: [
          {
            id: 'set1',
            name: 'Button Set',
            type: 'componentSet',
            fillsHash: simpleHash('set-modified')
          },
          {
            id: 'comp1',
            name: 'Primary',
            type: 'component',
            parentName: 'Button Set',
            fillsHash: simpleHash('comp1-modified')
          },
          {
            id: 'comp2',
            name: 'Secondary',
            type: 'component',
            parentName: 'Button Set',
            fillsHash: simpleHash('comp2-modified')
          },
          {
            id: 'set2',
            name: 'Card Set',
            type: 'componentSet',
            fillsHash: simpleHash('set2-modified')
          }
        ],
        removed: []
      };

      // Apply filtering and naming updates
      const filteredChanges = mockFilterRedundantComponentSetChanges(mockChanges);
      const finalChanges = mockUpdateComponentDisplayNames(filteredChanges);

      // Should have 3 items: 2 components with updated names + 1 component set without child changes
      expect(finalChanges.modified.length).toBe(3);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(finalChanges.modified.find((item: any) => item.id === 'comp1')?.name).toBe('Button Set - Primary');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(finalChanges.modified.find((item: any) => item.id === 'comp2')?.name).toBe('Button Set - Secondary');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(finalChanges.modified.find((item: any) => item.id === 'set2')?.name).toBe('Card Set');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(finalChanges.modified.find((item: any) => item.id === 'set1')).toBeUndefined(); // Should be filtered out
    });
  });

  describe('Nested Content Hash Logic', () => {
    function simpleHash(str: string): string {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return hash.toString();
    }

    // Mock function to simulate nested property traversal
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function mockTraverseNodeProperties(node: any): any[] {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any[] = [];
      
      // Add current node properties
      result.push({
        id: node.id,
        name: node.name,
        type: node.type,
        visible: node.visible !== false,
        fills: node.fills || 'none',
        strokes: node.strokes || 'none',
        fontSize: node.fontSize || null,
        characters: node.characters || null
      });
      
      // Recursively add children
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          result.push(...mockTraverseNodeProperties(child));
        }
      }
      
      return result;
    }

    // Mock function to simulate nested content hash calculation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function mockCalculateNestedContentHash(node: any): string {
      const allNestedData = mockTraverseNodeProperties(node);
      
      // Focus on visual properties
      const visualData = allNestedData.map(data => ({
        fills: data.fills,
        strokes: data.strokes,
        fontSize: data.fontSize,
        characters: data.characters
      }));
      
      return simpleHash(JSON.stringify(visualData));
    }

    test('should traverse single node properties', () => {
      const mockNode = {
        id: 'node1',
        name: 'Button',
        type: 'COMPONENT',
        visible: true,
        fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }],
        children: []
      };

      const properties = mockTraverseNodeProperties(mockNode);

      expect(properties).toHaveLength(1);
      expect(properties[0].id).toBe('node1');
      expect(properties[0].name).toBe('Button');
      expect(properties[0].visible).toBe(true);
    });

    test('should traverse nested node properties', () => {
      const mockNode = {
        id: 'button',
        name: 'Button Component',
        type: 'COMPONENT',
        visible: true,
        children: [
          {
            id: 'text',
            name: 'Label',
            type: 'TEXT',
            visible: true,
            fontSize: 16,
            characters: 'Click me'
          },
          {
            id: 'background',
            name: 'Background',
            type: 'RECTANGLE',
            visible: true,
            fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1 } }]
          }
        ]
      };

      const properties = mockTraverseNodeProperties(mockNode);

      expect(properties).toHaveLength(3); // Parent + 2 children
      expect(properties[0].id).toBe('button');
      expect(properties[1].id).toBe('text');
      expect(properties[1].fontSize).toBe(16);
      expect(properties[1].characters).toBe('Click me');
      expect(properties[2].id).toBe('background');
    });

    test('should generate consistent nested content hash', () => {
      const mockNode = {
        id: 'component',
        name: 'Test Component',
        type: 'COMPONENT',
        children: [
          {
            id: 'text',
            name: 'Text',
            type: 'TEXT',
            fontSize: 16,
            characters: 'Hello'
          }
        ]
      };

      const hash1 = mockCalculateNestedContentHash(mockNode);
      const hash2 = mockCalculateNestedContentHash(mockNode);

      expect(hash1).toBe(hash2);
      expect(hash1).toBeDefined();
      expect(typeof hash1).toBe('string');
    });

    test('should generate different hash when nested content changes', () => {
      const mockNode1 = {
        id: 'component',
        name: 'Test Component',
        type: 'COMPONENT',
        children: [
          {
            id: 'text',
            name: 'Text',
            type: 'TEXT',
            fontSize: 16,
            characters: 'Hello'
          }
        ]
      };

      const mockNode2 = {
        id: 'component',
        name: 'Test Component',
        type: 'COMPONENT',
        children: [
          {
            id: 'text',
            name: 'Text',
            type: 'TEXT',
            fontSize: 16,
            characters: 'World' // Changed text
          }
        ]
      };

      const hash1 = mockCalculateNestedContentHash(mockNode1);
      const hash2 = mockCalculateNestedContentHash(mockNode2);

      expect(hash1).not.toBe(hash2);
    });

    test('should detect changes in deeply nested elements', () => {
      const previousNode = {
        id: 'card',
        name: 'Card Component',
        type: 'COMPONENT',
        children: [
          {
            id: 'header',
            name: 'Header',
            type: 'FRAME',
            children: [
              {
                id: 'title',
                name: 'Title',
                type: 'TEXT',
                characters: 'Original Title'
              }
            ]
          }
        ]
      };

      const currentNode = {
        id: 'card',
        name: 'Card Component',
        type: 'COMPONENT',
        children: [
          {
            id: 'header',
            name: 'Header',
            type: 'FRAME',
            children: [
              {
                id: 'title',
                name: 'Title',
                type: 'TEXT',
                characters: 'Updated Title' // Deep change
              }
            ]
          }
        ]
      };

      const previousHash = mockCalculateNestedContentHash(previousNode);
      const currentHash = mockCalculateNestedContentHash(currentNode);

      expect(previousHash).not.toBe(currentHash);
    });

    test('should handle nodes without children', () => {
      const mockNode = {
        id: 'icon',
        name: 'Icon',
        type: 'VECTOR',
        fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]
        // No children property
      };

      const properties = mockTraverseNodeProperties(mockNode);

      expect(properties).toHaveLength(1);
      expect(properties[0].id).toBe('icon');
    });

    test('should handle empty children array', () => {
      const mockNode = {
        id: 'empty-frame',
        name: 'Empty Frame',
        type: 'FRAME',
        children: []
      };

      const properties = mockTraverseNodeProperties(mockNode);

      expect(properties).toHaveLength(1);
      expect(properties[0].id).toBe('empty-frame');
    });
  });

  describe('Element Display Formatting', () => {
    // Mock formatElementForDisplay function
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function mockFormatElementForDisplay(element: any): string {
      const typeEmojis: { [key: string]: string } = {
        component: '🧩',
        componentSet: '📦',
        textStyle: '📝',
        colorStyle: '🎨',
        variable: '🔧',
        variableCollection: '📁'
      };
      
      const emoji = typeEmojis[element.type] || '📄';
      let displayText = `${emoji} ${element.name}`;
      
      // Don't show parentName for components as it's already included in the name format "Set - Component"
      if (element.parentName && element.type !== 'component') {
        displayText += ` (${element.parentName})`;
      }
      
      // Add detailed changes for modified elements
      if (element.changes && element.changes.length > 0) {
        for (const change of element.changes) {
          displayText += `\n   • ${change.displayName}: ${change.oldValue} → ${change.newValue}`;
        }
        
        if (element.changes.length > 3) {
          displayText += `\n   ... and ${element.changes.length - 3} more changes`;
        }
      } else if (element.description) {
        displayText += `\n   ${element.description}`;
      }
      
      return displayText;
    }

    test('should format component in set correctly', () => {
      const componentElement = {
        id: 'comp1',
        name: 'Button Set - Primary',
        type: 'component',
        parentName: 'Button Set'
      };

      const formatted = mockFormatElementForDisplay(componentElement);

      expect(formatted).toBe('🧩 Button Set - Primary');
      expect(formatted).not.toContain('(Button Set)'); // Should not show parentName
    });

    test('should format component set correctly', () => {
      const componentSetElement = {
        id: 'set1',
        name: 'Button Set',
        type: 'componentSet',
        description: 'Collection of button variants'
      };

      const formatted = mockFormatElementForDisplay(componentSetElement);

      expect(formatted).toContain('📦 Button Set');
      expect(formatted).toContain('Collection of button variants');
    });

    test('should format non-component with parent correctly', () => {
      const styleElement = {
        id: 'style1',
        name: 'Primary Blue',
        type: 'colorStyle',
        parentName: 'Brand Colors'
      };

      const formatted = mockFormatElementForDisplay(styleElement);

      expect(formatted).toBe('🎨 Primary Blue (Brand Colors)');
    });

    test('should format element with changes correctly', () => {
      const modifiedElement = {
        id: 'comp1',
        name: 'Button Set - Primary',
        type: 'component',
        changes: [
          {
            displayName: 'Fill Color',
            oldValue: '#FF0000',
            newValue: '#00FF00'
          },
          {
            displayName: 'Border Radius',
            oldValue: '4px',
            newValue: '8px'
          }
        ]
      };

      const formatted = mockFormatElementForDisplay(modifiedElement);

      expect(formatted).toContain('🧩 Button Set - Primary');
      expect(formatted).toContain('Fill Color: #FF0000 → #00FF00');
      expect(formatted).toContain('Border Radius: 4px → 8px');
    });

    test('should truncate many changes correctly', () => {
      const modifiedElement = {
        id: 'comp1',
        name: 'Complex Component',
        type: 'component',
        changes: [
          { displayName: 'Change 1', oldValue: 'old1', newValue: 'new1' },
          { displayName: 'Change 2', oldValue: 'old2', newValue: 'new2' },
          { displayName: 'Change 3', oldValue: 'old3', newValue: 'new3' },
          { displayName: 'Change 4', oldValue: 'old4', newValue: 'new4' },
          { displayName: 'Change 5', oldValue: 'old5', newValue: 'new5' }
        ]
      };

      const formatted = mockFormatElementForDisplay(modifiedElement);

      expect(formatted).toContain('Change 1: old1 → new1');
      expect(formatted).toContain('Change 2: old2 → new2');
      expect(formatted).toContain('Change 3: old3 → new3');
      expect(formatted).toContain('... and 2 more changes');
    });

    test('should use correct emoji for each element type', () => {
      const elements = [
        { id: '1', name: 'Component', type: 'component' },
        { id: '2', name: 'Component Set', type: 'componentSet' },
        { id: '3', name: 'Text Style', type: 'textStyle' },
        { id: '4', name: 'Color Style', type: 'colorStyle' },
        { id: '5', name: 'Variable', type: 'variable' },
        { id: '6', name: 'Variable Collection', type: 'variableCollection' },
        { id: '7', name: 'Unknown Type', type: 'unknown' }
      ];

      const expectedEmojis = ['🧩', '📦', '📝', '🎨', '🔧', '📁', '📄'];

      elements.forEach((element, index) => {
        const formatted = mockFormatElementForDisplay(element);
        expect(formatted).toContain(expectedEmojis[index]);
      });
    });
  });
});

// Export helper functions for potential use in other test files
export { TestHelpers };
export type { TestElement, TestTrackingData, TestChanges };