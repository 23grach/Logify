/// <reference types="jest" />

// Type definitions for mocks
interface MockMessage {
  type: string;
  [key: string]: unknown;
}

interface MockFigmaNode {
  id?: string;
  name?: string;
  type?: string;
  [key: string]: unknown;
}

// Mock Figma API
const mockFigma = {
  root: {
    children: [] as MockFigmaNode[],
    getSharedPluginData: jest.fn(),
    setSharedPluginData: jest.fn(),
  },
  ui: {
    postMessage: jest.fn(),
    onmessage: null as ((msg: MockMessage) => void) | null,
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

// Import the code after mocking
import './code';

describe('Logify Plugin Functional Tests', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Reset mock data
    mockFigma.root.children = [];
    mockFigma.root.getSharedPluginData.mockReturnValue('');
  });

  describe('Plugin Initialization', () => {
    test('should initialize plugin and show UI', () => {
      // Test that plugin shows UI on startup
      expect(mockFigma.showUI).toHaveBeenCalledWith(expect.any(String), { width: 400, height: 500 });
    });

    test('should handle first-time initialization', async () => {
      // Mock no existing data
      mockFigma.root.getSharedPluginData.mockReturnValue('');
      
      // Simulate initialization message
      const initMessage = { type: 'initialize' };
      
      if (mockFigma.ui.onmessage) {
        await mockFigma.ui.onmessage(initMessage);
      }
      
      // Should attempt to post initialization message
      expect(mockFigma.ui.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'init' })
      );
    });
  });

  describe('Data Storage and Retrieval', () => {
    test('should handle empty storage correctly', () => {
      mockFigma.root.getSharedPluginData.mockReturnValue('');
      
      // Import functions to test (they're not exported, so we test via message handling)
      const initMessage = { type: 'viewRecords' };
      
      if (mockFigma.ui.onmessage) {
        mockFigma.ui.onmessage(initMessage);
      }
      
      expect(mockFigma.ui.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          message: 'No records found'
        })
      );
    });

    test('should handle chunked data storage', () => {
      // Mock existing chunked data
      const mockMetadata = {
        chunkCount: 2,
        timestamp: Date.now(),
        totalLength: 1000
      };
      
      mockFigma.root.getSharedPluginData.mockImplementation((namespace, key) => {
        if (key === 'trackingData_meta') {
          return JSON.stringify(mockMetadata);
        }
        if (key === 'trackingData_chunk_0') {
          return '{"t":' + mockMetadata.timestamp + ',"e":[{"i":"1","n":"Test","ty":"component"}';
        }
        if (key === 'trackingData_chunk_1') {
          return ']}';
        }
        return '';
      });
      
      const viewMessage = { type: 'viewRecords' };
      
      if (mockFigma.ui.onmessage) {
        mockFigma.ui.onmessage(viewMessage);
      }
      
      expect(mockFigma.ui.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'records',
          elements: expect.any(Array),
          timestamp: expect.any(Number)
        })
      );
    });
  });

  describe('Element Collection', () => {
    test('should collect components from pages', async () => {
      // Mock page with components
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
          if (types.includes('COMPONENT_SET')) return [];
          return [];
        })
      };

      mockFigma.root.children = [mockPage];
      mockFigma.getLocalTextStylesAsync.mockResolvedValue([]);
      mockFigma.getLocalPaintStylesAsync.mockResolvedValue([]);
      mockFigma.getLocalEffectStylesAsync.mockResolvedValue([]);
      mockFigma.getLocalGridStylesAsync.mockResolvedValue([]);

      const initMessage = { type: 'initialize' };
      
      if (mockFigma.ui.onmessage) {
        await mockFigma.ui.onmessage(initMessage);
      }

      expect(mockPage.findAllWithCriteria).toHaveBeenCalledWith({ types: ['COMPONENT'] });
      expect(mockPage.findAllWithCriteria).toHaveBeenCalledWith({ types: ['COMPONENT_SET'] });
    });

    test('should collect styles', async () => {
      const mockTextStyle = {
        id: 'style1',
        name: 'Heading',
        type: 'TEXT',
        key: 'stylekey1',
        description: 'Main heading style',
        fontName: { family: 'Inter', style: 'Bold' },
        fontSize: 24
      };

      mockFigma.root.children = [];
      mockFigma.getLocalTextStylesAsync.mockResolvedValue([mockTextStyle]);
      mockFigma.getLocalPaintStylesAsync.mockResolvedValue([]);
      mockFigma.getLocalEffectStylesAsync.mockResolvedValue([]);
      mockFigma.getLocalGridStylesAsync.mockResolvedValue([]);

      const initMessage = { type: 'initialize' };
      
      if (mockFigma.ui.onmessage) {
        await mockFigma.ui.onmessage(initMessage);
      }

      expect(mockFigma.getLocalTextStylesAsync).toHaveBeenCalled();
      expect(mockFigma.getLocalPaintStylesAsync).toHaveBeenCalled();
      expect(mockFigma.getLocalEffectStylesAsync).toHaveBeenCalled();
      expect(mockFigma.getLocalGridStylesAsync).toHaveBeenCalled();
    });
  });

  describe('Change Detection', () => {
    test('should detect new elements', async () => {
      // Mock existing data with one element
      const existingData = {
        t: Date.now() - 10000,
        e: [{
          i: 'existing1',
          n: 'Old Button',
          ty: 'component',
          k: 'oldkey',
          d: 'Old description'
        }]
      };

      mockFigma.root.getSharedPluginData.mockImplementation((namespace, key) => {
        if (key === 'trackingData_meta') {
          return JSON.stringify({ chunkCount: 1, timestamp: existingData.t, totalLength: 100 });
        }
        if (key === 'trackingData_chunk_0') {
          return JSON.stringify(existingData);
        }
        return '';
      });

      // Mock current state with new element
      const mockNewComponent = {
        id: 'new1',
        name: 'New Button',
        type: 'COMPONENT',
        key: 'newkey',
        description: 'New button component',
        variantProperties: null,
        parent: null,
        children: []
      };

      const mockPage = {
        name: 'Page 1',
        getSharedPluginData: jest.fn().mockReturnValue(''),
        loadAsync: jest.fn().mockResolvedValue(undefined),
        findAllWithCriteria: jest.fn().mockImplementation(({ types }) => {
          if (types.includes('COMPONENT')) return [mockNewComponent];
          if (types.includes('COMPONENT_SET')) return [];
          return [];
        })
      };

      mockFigma.root.children = [mockPage];
      mockFigma.getLocalTextStylesAsync.mockResolvedValue([]);
      mockFigma.getLocalPaintStylesAsync.mockResolvedValue([]);
      mockFigma.getLocalEffectStylesAsync.mockResolvedValue([]);
      mockFigma.getLocalGridStylesAsync.mockResolvedValue([]);

      const refreshMessage = { type: 'refresh' };
      
      if (mockFigma.ui.onmessage) {
        await mockFigma.ui.onmessage(refreshMessage);
      }

      // Should detect changes
      expect(mockFigma.ui.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'changes',
          changes: expect.objectContaining({
            added: expect.any(Array),
            modified: expect.any(Array),
            removed: expect.any(Array)
          }),
          hasChanges: expect.any(Boolean)
        })
      );
    });
  });

  describe('Add to Figma Functionality', () => {
    test('should create changelog entry in Figma', async () => {
      const mockChanges = {
        added: [{
          id: 'new1',
          name: 'New Button',
          type: 'component',
          key: 'newkey',
          description: 'New button'
        }],
        modified: [],
        removed: []
      };

      // Mock Figma page creation
      const mockPage = {
        name: '🖹Logify',
        loadAsync: jest.fn().mockResolvedValue(undefined),
        findOne: jest.fn().mockReturnValue(null),
        appendChild: jest.fn()
      };

      const mockFrame = {
        name: 'Changelog Container',
        layoutMode: 'VERTICAL',
        primaryAxisSizingMode: 'AUTO',
        counterAxisSizingMode: 'FIXED',
        resize: jest.fn(),
        itemSpacing: 24,
        paddingTop: 24,
        paddingBottom: 24,
        paddingLeft: 24,
        paddingRight: 24,
        fills: [],
        cornerRadius: 16,
        strokes: [],
        strokeWeight: 1,
        children: [],
        insertChild: jest.fn(),
        appendChild: jest.fn()
      };

      const _mockEntryFrame = {
        name: expect.stringContaining('Logify Entry'),
        layoutMode: 'VERTICAL',
        primaryAxisSizingMode: 'AUTO',
        counterAxisSizingMode: 'AUTO',
        layoutAlign: 'STRETCH',
        itemSpacing: 16,
        fills: [],
        appendChild: jest.fn()
      };

      const mockText = {
        characters: '',
        fontSize: 18,
        fontName: { family: 'Inter', style: 'Semi Bold' },
        fills: [],
        lineHeight: { value: 20, unit: 'PIXELS' }
      };

      mockFigma.root.children = [mockPage];
      mockFigma.createPage.mockReturnValue(mockPage);
      mockFigma.createFrame.mockReturnValue(mockFrame);
      mockFigma.createText.mockReturnValue(mockText);
      mockFigma.loadFontAsync.mockResolvedValue(undefined);
      mockFigma.setCurrentPageAsync.mockResolvedValue(undefined);

      // Mock empty current state for updateTrackingData
      mockFigma.getLocalTextStylesAsync.mockResolvedValue([]);
      mockFigma.getLocalPaintStylesAsync.mockResolvedValue([]);
      mockFigma.getLocalEffectStylesAsync.mockResolvedValue([]);
      mockFigma.getLocalGridStylesAsync.mockResolvedValue([]);

      const addMessage = { 
        type: 'addToFigma', 
        changes: mockChanges 
      };
      
      if (mockFigma.ui.onmessage) {
        await mockFigma.ui.onmessage(addMessage);
      }

      expect(mockFigma.loadFontAsync).toHaveBeenCalledWith({ family: 'Inter', style: 'Regular' });
      expect(mockFigma.loadFontAsync).toHaveBeenCalledWith({ family: 'Inter', style: 'Medium' });
      expect(mockFigma.loadFontAsync).toHaveBeenCalledWith({ family: 'Inter', style: 'Semi Bold' });
      expect(mockFigma.createFrame).toHaveBeenCalled();
      expect(mockFigma.createText).toHaveBeenCalled();
    });

    test('should validate changes before adding to Figma', async () => {
      const invalidChanges = {
        added: 'not an array', // Invalid data
        modified: [],
        removed: []
      };

      const addMessage = { 
        type: 'addToFigma', 
        changes: invalidChanges 
      };
      
      if (mockFigma.ui.onmessage) {
        await mockFigma.ui.onmessage(addMessage);
      }

      expect(mockFigma.ui.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          message: 'Invalid data format'
        })
      );
      expect(mockFigma.notify).toHaveBeenCalledWith('Invalid data format', { error: true });
    });
  });

  describe('Error Handling', () => {
    test('should handle initialization errors gracefully', async () => {
      // Mock error during initialization
      mockFigma.getLocalTextStylesAsync.mockRejectedValue(new Error('API Error'));

      const initMessage = { type: 'initialize' };
      
      if (mockFigma.ui.onmessage) {
        await mockFigma.ui.onmessage(initMessage);
      }

      expect(mockFigma.ui.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          message: expect.stringContaining('Failed to initialize tracking')
        })
      );
      expect(mockFigma.notify).toHaveBeenCalledWith('Initialization failed', { error: true });
    });

    test('should handle scan errors gracefully', async () => {
      // Mock error during scanning
      mockFigma.root.children = [{
        loadAsync: jest.fn().mockRejectedValue(new Error('Load Error'))
      }];

      const refreshMessage = { type: 'refresh' };
      
      if (mockFigma.ui.onmessage) {
        await mockFigma.ui.onmessage(refreshMessage);
      }

      expect(mockFigma.ui.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          message: expect.stringContaining('Failed to scan for changes')
        })
      );
      expect(mockFigma.notify).toHaveBeenCalledWith('Scan failed', { error: true });
    });

    test('should handle unknown message types', async () => {
      const unknownMessage = { type: 'unknownCommand' };
      
      if (mockFigma.ui.onmessage) {
        await mockFigma.ui.onmessage(unknownMessage);
      }

      expect(mockFigma.ui.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          message: 'Unknown command: unknownCommand'
        })
      );
    });
  });

  describe('Data Validation', () => {
    test('should validate design system elements', () => {
      // Test valid element
      const _validElement = {
        id: 'test1',
        name: 'Test Component',
        type: 'component',
        key: 'testkey',
        description: 'Test description',
        variantPropertiesHash: undefined,
        parentName: undefined,
        modifiedAt: Date.now(),
        updatedAt: Date.now()
      };

      // Test invalid element
      const invalidElement = {
        id: 123, // Should be string
        name: 'Test Component',
        type: 'component'
      };

      // These functions are not exported, so we test them indirectly
      // by ensuring the plugin handles invalid data correctly
      const addMessage = { 
        type: 'addToFigma', 
        changes: {
          added: [invalidElement],
          modified: [],
          removed: []
        }
      };
      
      if (mockFigma.ui.onmessage) {
        mockFigma.ui.onmessage(addMessage);
      }

      expect(mockFigma.ui.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          message: 'Invalid data format'
        })
      );
    });
  });

  describe('Hash Functions', () => {
    test('should handle hash calculations for different node types', async () => {
      // Mock different types of components
      const mockComponentWithVariants = {
        id: 'comp1',
        name: 'Button',
        type: 'COMPONENT',
        key: 'key1',
        description: 'A button component',
        variantProperties: { Size: 'Large', State: 'Default' },
        parent: { type: 'COMPONENT_SET', name: 'Button Set' },
        children: []
      };

      const mockComponentSet = {
        id: 'set1',
        name: 'Button Set',
        type: 'COMPONENT_SET',
        key: 'setkey1',
        description: 'Button component set',
        componentPropertyDefinitions: { Size: { type: 'VARIANT' } },
        children: [mockComponentWithVariants]
      };

      const mockPage = {
        name: 'Page 1',
        getSharedPluginData: jest.fn().mockReturnValue(''),
        loadAsync: jest.fn().mockResolvedValue(undefined),
        findAllWithCriteria: jest.fn().mockImplementation(({ types }) => {
          if (types.includes('COMPONENT')) return [mockComponentWithVariants];
          if (types.includes('COMPONENT_SET')) return [mockComponentSet];
          return [];
        })
      };

      mockFigma.root.children = [mockPage];
      mockFigma.getLocalTextStylesAsync.mockResolvedValue([]);
      mockFigma.getLocalPaintStylesAsync.mockResolvedValue([]);
      mockFigma.getLocalEffectStylesAsync.mockResolvedValue([]);
      mockFigma.getLocalGridStylesAsync.mockResolvedValue([]);

      const initMessage = { type: 'initialize' };
      
      if (mockFigma.ui.onmessage) {
        await mockFigma.ui.onmessage(initMessage);
      }

      // Should handle both component types without errors
      expect(mockFigma.ui.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'initialized',
          count: expect.any(Number)
        })
      );
    });
  });
}); 