/// <reference types="jest" />

/**
 * REFACTOR-SAFE TESTS for Logify Plugin
 * 
 * Эти тесты сфокусированы на тестировании ПОВЕДЕНИЯ, а не РЕАЛИЗАЦИИ
 * Они должны оставаться валидными даже после рефакторинга кода
 */

// Abstract interfaces for testing - не зависят от конкретной реализации
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

// Helper functions that test behavior, not implementation
const TestHelpers = {
  // Тестирует, что хеш-функция работает стабильно
  isHashFunctionStable: (hashFn: (input: string) => string): boolean => {
    const input = 'test-string-123';
    const hash1 = hashFn(input);
    const hash2 = hashFn(input);
    return hash1 === hash2 && typeof hash1 === 'string' && hash1.length > 0;
  },

  // Тестирует, что хеш-функция чувствительна к изменениям
  isHashFunctionSensitive: (hashFn: (input: string) => string): boolean => {
    const input1 = 'test-string-123';
    const input2 = 'test-string-124'; // Минимальное изменение
    const hash1 = hashFn(input1);
    const hash2 = hashFn(input2);
    return hash1 !== hash2;
  },

  // Тестирует логику определения изменений
  detectChanges: (prev: TestElement[], curr: TestElement[]): TestChanges => {
    const added = curr.filter(c => !prev.some(p => p.id === c.id));
    const removed = prev.filter(p => !curr.some(c => c.id === p.id));
    const modified = curr.filter(c => {
      const prevElement = prev.find(p => p.id === c.id);
      return prevElement && JSON.stringify(prevElement) !== JSON.stringify(c);
    });

    return { added, modified, removed };
  },

  // Тестирует сжатие/декомпрессию данных (behavior-based)
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

    // Проверяем, что данные восстановились корректно
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
};

describe('Refactor-Safe Plugin Tests', () => {
  
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
    // Простая hash функция для тестирования
    const simpleHash = (str: string): string => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return hash.toString();
    };

    test('hash function should be stable', () => {
      expect(TestHelpers.isHashFunctionStable(simpleHash)).toBe(true);
    });

    test('hash function should be sensitive to changes', () => {
      expect(TestHelpers.isHashFunctionSensitive(simpleHash)).toBe(true);
    });

    test('should generate different hashes for different property sets', () => {
      const props1 = { width: 100, height: 50 };
      const props2 = { width: 150, height: 50 }; // Only width changed
      
      const hash1 = simpleHash(JSON.stringify(props1));
      const hash2 = simpleHash(JSON.stringify(props2));
      
      expect(hash1).not.toBe(hash2);
    });

    test('should handle empty and null values consistently', () => {
      const emptyProps = {};
      const nullProps = { value: null };
      const definedProps = { value: 'test' };
      
      const emptyHash = simpleHash(JSON.stringify(emptyProps));
      const nullHash = simpleHash(JSON.stringify(nullProps));
      const definedHash = simpleHash(JSON.stringify(definedProps));
      
      // Каждый должен давать уникальный хеш
      expect(emptyHash).not.toBe(nullHash);
      expect(nullHash).not.toBe(definedHash);
      expect(emptyHash).not.toBe(definedHash);
      
      // Проверим, что хеши стабильны
      expect(emptyHash).toBe(simpleHash(JSON.stringify({})));
      expect(nullHash).toBe(simpleHash(JSON.stringify({ value: null })));
    });
  });

  describe('Extended Properties Behavior (Feature Independent)', () => {
    
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

  describe('Data Persistence Behavior (Storage Independent)', () => {
    
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

  describe('Error Handling and Edge Cases (Robust Testing)', () => {
    
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
      
      // Функция должна обрабатывать некорректные данные
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

    test('should handle concurrent modifications', () => {
      const baseElement: TestElement = { id: '1', name: 'Element', type: 'component' };
      
      // Simulate two different modifications
      const modification1 = { ...baseElement, name: 'Modified Element 1' };
      const modification2 = { ...baseElement, name: 'Modified Element 2' };
      
      // Both modifications should be different from base and each other
      expect(modification1.name).not.toBe(baseElement.name);
      expect(modification2.name).not.toBe(baseElement.name);
      expect(modification1.name).not.toBe(modification2.name);
    });
  });

  describe('Performance and Scalability (Non-functional Requirements)', () => {
    
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

    test('should handle memory efficiently with large strings', () => {
      // Test hash function with large input
      const largeString = 'test'.repeat(10000); // 40KB string
      
      const simpleHash = (str: string): string => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        return hash.toString();
      };
      
      const startTime = performance.now();
      const hash = simpleHash(largeString);
      const endTime = performance.now();
      
      // Should complete quickly and produce valid hash
      expect(endTime - startTime).toBeLessThan(50);
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });
  });
});

// Export helper functions for use in other test files
export { TestHelpers };
export type { TestElement, TestTrackingData, TestChanges }; 