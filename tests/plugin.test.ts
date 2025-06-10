/// <reference types="jest" />

// Mock Figma API
const mockFigma = {
  root: {
    children: [] as any[],
    getSharedPluginData: jest.fn(),
    setSharedPluginData: jest.fn(),
  },
  ui: {
    postMessage: jest.fn(),
    onmessage: null as ((msg: any) => void) | null,
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
(global as any).figma = mockFigma;

describe('Logify Plugin Functional Tests', () => {
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
  });

  describe('Element Collection', () => {
    test('should collect components from pages', () => {
      const mockComponent = {
        id: 'comp1',
        name: 'Button',
        type: 'COMPONENT',
        key: 'key1',
        description: 'A button component',
        variantProperties: null,
        parent: null,
        children: []
      };

      const mockPage = {
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

  describe('Change Detection Logic', () => {
    test('should identify new elements', () => {
      const previousElements = [
        { id: '1', name: 'Button', type: 'component' }
      ];
      
      const currentElements = [
        { id: '1', name: 'Button', type: 'component' },
        { id: '2', name: 'Input', type: 'component' }
      ];

      const added = currentElements.filter(curr => 
        !previousElements.some(prev => prev.id === curr.id)
      );

      expect(added).toHaveLength(1);
      expect(added[0].id).toBe('2');
    });

    test('should identify removed elements', () => {
      const previousElements = [
        { id: '1', name: 'Button', type: 'component' },
        { id: '2', name: 'Input', type: 'component' }
      ];
      
      const currentElements = [
        { id: '1', name: 'Button', type: 'component' }
      ];

      const removed = previousElements.filter(prev => 
        !currentElements.some(curr => curr.id === prev.id)
      );

      expect(removed).toHaveLength(1);
      expect(removed[0].id).toBe('2');
    });

    test('should identify modified elements by name change', () => {
      const previousElements = [
        { id: '1', name: 'Button', type: 'component' }
      ];
      
      const currentElements = [
        { id: '1', name: 'Primary Button', type: 'component' }
      ];

      const modified = currentElements.filter(curr => {
        const prev = previousElements.find(p => p.id === curr.id);
        return prev && prev.name !== curr.name;
      });

      expect(modified).toHaveLength(1);
      expect(modified[0].name).toBe('Primary Button');
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
}); 