/* eslint-disable @figma/figma-plugins/dynamic-page-find-method-advice */
/// <reference types="@figma/plugin-typings" />

/**
 * Logify - Design System Tracker
 * 
 * A Figma plugin that automatically tracks changes to design system elements
 * and creates detailed changelog entries with visual documentation.
 * 
 * This plugin monitors components, styles, and variables for modifications,
 * additions, and removals, providing comprehensive change tracking for
 * design systems.
 */

// ========================================================================================
// TYPE DEFINITIONS
// ========================================================================================
// This section contains all TypeScript interfaces, types, and type guards used throughout
// the plugin for design system element tracking and plugin communication.

/**
 * Represents a design system element that can be tracked for changes.
 * This includes components, styles, and variables with their metadata.
 */
interface DesignSystemElement {
  /** Unique identifier for the element */
  id: string;
  
  /** Display name of the element */
  name: string;
  
  /** Type classification of the design system element */
  type: 'component' | 'componentSet' | 'textStyle' | 'colorStyle' | 'variable' | 'variableCollection';
  
  /** Optional key identifier for published elements */
  key?: string;
  
  /** Optional description or documentation */
  description?: string;
  
  /** Variant properties for component sets and instances */
  variantProperties?: { [property: string]: string } | null;
  
  /** Hash of variant properties for change detection */
  variantPropertiesHash?: string;
  
  /** Parent element name for nested structures */
  parentName?: string;
  
  /** Last modification timestamp */
  modifiedAt?: number;
  
  /** Last update timestamp */
  updatedAt?: number;
  
  // Property hashes for efficient change detection
  fillsHash?: string;
  strokesHash?: string;
  effectsHash?: string;
  propertiesHash?: string;
  componentPropertiesHash?: string;
  childrenIds?: string[];
  structureHash?: string;
  layoutHash?: string;
  geometryHash?: string;
  appearanceHash?: string;
  borderHash?: string;
  typographyHash?: string;
  variableUsageHash?: string;
  variableDefinitionHash?: string;
  interactionHash?: string;
  instanceOverridesHash?: string;
  exposedPropertiesHash?: string;
  
  // Detailed property data for comparison
  fillsData?: string;
  strokesData?: string;
  cornerRadiusData?: string;
  sizeData?: string;
  effectsData?: string;
  typographyData?: string;
  nestedContentHash?: string;
}

/**
 * Detailed information about a specific property change.
 */
interface PropertyChangeInfo {
  /** Internal property name */
  property: string;
  
  /** Human-readable display name */
  displayName: string;
  
  /** Previous property value */
  oldValue: string;
  
  /** New property value */
  newValue: string;
  
  /** Type of change performed */
  changeType: 'added' | 'removed' | 'modified';
}

/**
 * Enhanced element with detailed change information.
 */
interface DetailedModifiedElement extends DesignSystemElement {
  /** Array of detailed property changes */
  changes: PropertyChangeInfo[];
  
  /** Human-readable summary of all changes */
  changesSummary: string;
}

/**
 * Container for tracking data with timestamp.
 */
interface TrackingData {
  /** Timestamp when data was captured */
  timestamp: number;
  
  /** Array of tracked design system elements */
  elements: DesignSystemElement[];
}

/**
 * Change detection results categorized by operation type.
 */
interface Changes {
  /** Newly added elements */
  added: DesignSystemElement[];
  
  /** Modified existing elements with detailed changes */
  modified: DetailedModifiedElement[];
  
  /** Removed elements */
  removed: DesignSystemElement[];
  
  /** Optional user comment for the changelog entry */
  comment?: string;
}

/**
 * Strongly typed plugin messages for better type safety and IDE support.
 * Each message type has its own interface with specific properties.
 */
type PluginMessage = 
  | { type: 'initialize' }
  | { type: 'refresh' }
  | { type: 'addToFigma'; changes: Changes; comment?: string }
  | { type: 'skipVersion' }
  | { type: 'viewRecords' }
  | { type: 'getPerformanceMetrics' }
  | { type: 'clearPerformanceMetrics' }
  | { type: 'exportLogs' }
  | { type: 'clearLogs' }
  | { type: 'setLogLevel'; level: number };

/**
 * Type guard to validate if a message is a valid PluginMessage.
 * Provides runtime type checking for incoming messages.
 * 
 * @param msg - The message to validate
 * @returns True if the message is a valid PluginMessage
 */
function isValidPluginMessage(msg: unknown): msg is PluginMessage {
  if (!msg || typeof msg !== 'object') {
    return false;
  }
  
  const message = msg as Record<string, unknown>;
  if (typeof message.type !== 'string') {
    return false;
  }
  
  const validTypes = [
    'initialize', 'refresh', 'addToFigma', 'skipVersion', 'viewRecords',
    'getPerformanceMetrics', 'clearPerformanceMetrics', 'exportLogs', 'clearLogs', 'setLogLevel'
  ];
  return validTypes.includes(message.type);
}

// ========================================================================================
// CONFIGURATION & CONSTANTS
// ========================================================================================
// This section contains all configuration constants, storage keys, UI dimensions,
// and other constant values used throughout the plugin.

/**
 * Plugin configuration constants centralized for easy maintenance and modification.
 * All configuration values are organized by functional area for better discoverability.
 */
const CONFIG = {
  // Storage configuration
  STORAGE: {
    NAMESPACE: 'changelog_tracker',
    TRACKING_DATA_KEY: 'trackingData',
    CHUNK_SIZE_LIMIT: 90000, // Figma's plugin data limit per key
  },
  
  // UI configuration  
  UI: {
    WINDOW_SIZE: { width: 400, height: 600 },
    PAGE_NAME: '🖹 Logify',
    CONTAINER_NAME: 'Changelog Container',
    ENTRY_PREFIX: 'Logify Entry',
  },
  
  // Limits and validation
  LIMITS: {
    COMMENT_MAX_LENGTH: 500,
    TEXT_WRAP_LENGTH: 60,
    MAX_ELEMENTS_PER_SCAN: 10000,
  },
  
  // Performance configuration
  PERFORMANCE: {
    SLOW_OPERATION_THRESHOLD: 500, // Reduced threshold for better UX
    BATCH_SIZE: 100, // Increased batch size for better throughput
    MAX_CONCURRENT_OPERATIONS: 3, // Reduced to prevent overload
    CACHE_DURATION: 30000, // 30 seconds cache
    DEBOUNCE_DELAY: 250, // Debounce user actions
    INCREMENTAL_SCAN_THRESHOLD: 1000, // Switch to incremental scanning after this many elements
  },
  
  // Visual styling constants
  COLORS: {
    BACKGROUND: { r: 0.95, g: 0.97, b: 1 },
    TEXT: { r: 0.2, g: 0.2, b: 0.2 },
    ACCENT: { r: 0, g: 0.48, b: 1 },
    COMMENT_BG: { r: 0.97, g: 0.99, b: 1 },
  },
  
  // Typography
  TYPOGRAPHY: {
    FONT_FAMILY: 'Inter',
    TITLE_SIZE: 18,
    BODY_SIZE: 14,
    SMALL_SIZE: 12,
  }
} as const;

// Legacy constants for backward compatibility (to be removed in future updates)
/** @deprecated Use CONFIG.STORAGE.NAMESPACE instead */
const PLUGIN_NAMESPACE = CONFIG.STORAGE.NAMESPACE;
/** @deprecated Use CONFIG.STORAGE.TRACKING_DATA_KEY instead */
const TRACKING_DATA_KEY = CONFIG.STORAGE.TRACKING_DATA_KEY;
/** @deprecated Use CONFIG.STORAGE.CHUNK_SIZE_LIMIT instead */
const CHUNK_SIZE_LIMIT = CONFIG.STORAGE.CHUNK_SIZE_LIMIT;
/** @deprecated Use CONFIG.UI.PAGE_NAME instead */
const LOGIFY_PAGE_NAME = CONFIG.UI.PAGE_NAME;
/** @deprecated Use CONFIG.UI.CONTAINER_NAME instead */
const CHANGELOG_CONTAINER_NAME = CONFIG.UI.CONTAINER_NAME;
/** @deprecated Use CONFIG.UI.ENTRY_PREFIX instead */
const ENTRY_NAME_PREFIX = CONFIG.UI.ENTRY_PREFIX;

// ========================================================================================
// ERROR HANDLING
// ========================================================================================
// This section provides centralized error handling utilities for consistent error
// processing, logging, and user feedback throughout the plugin.

/**
 * Centralized error handling for consistent error processing throughout the plugin.
 * Provides unified logging, user notifications, and UI communication for all errors.
 * 
 * @param error - The error that occurred
 * @param context - Descriptive context of where the error occurred
 * @param showNotification - Whether to show user notification (default: true)
 * @param notifyUI - Whether to notify the UI about the error (default: true)
 */
function handleError(error: unknown, context: string, showNotification = true, notifyUI = true): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const fullMessage = `[${context}] ${errorMessage}`;
  
  // Always log the full error details
  console.error(fullMessage, error);
  
  // Show user notification if requested
  if (showNotification) {
    figma.notify(`Error in ${context}`, { error: true });
  }
  
  // Notify UI about the error if requested
  if (notifyUI) {
    figma.ui.postMessage({
      type: 'error',
      message: errorMessage,
      context: context
    });
  }
}

/**
 * Wrapper for async functions to provide consistent error handling.
 * Automatically catches errors and processes them through the centralized handler.
 * 
 * @param fn - The async function to execute
 * @param context - Context description for error reporting
 * @param showNotification - Whether to show user notifications on error
 * @returns Promise that resolves with function result or undefined on error
 */
async function withErrorHandling<T>(
  fn: () => Promise<T>, 
  context: string, 
  showNotification = true
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    handleError(error, context, showNotification);
    return undefined;
  }
}

// ========================================================================================
// PERFORMANCE MONITORING
// ========================================================================================
// This section contains performance monitoring functions that track execution times,
// memory usage, and operation efficiency for optimization purposes.

/**
 * Performance metrics for tracking operation efficiency.
 */
interface PerformanceMetrics {
  /** Operation identifier */
  operation: string;
  
  /** Start timestamp */
  startTime: number;
  
  /** End timestamp */
  endTime?: number;
  
  /** Duration in milliseconds */
  duration?: number;
  
  /** Memory usage before operation */
  memoryBefore?: number;
  
  /** Memory usage after operation */
  memoryAfter?: number;
  
  /** Number of elements processed */
  elementsProcessed?: number;
  
  /** Additional context data */
  metadata?: Record<string, unknown>;
}

/**
 * Performance monitoring utility class for tracking operation efficiency.
 */
class PerformanceMonitor {
  private static metrics: PerformanceMetrics[] = [];
  private static readonly MAX_METRICS = 100;
  
  /**
   * Starts performance monitoring for an operation.
   * 
   * @param operation - Name of the operation to monitor
   * @param metadata - Additional context data
   * @returns Performance metrics object
   */
  static startOperation(operation: string, metadata?: Record<string, unknown>): PerformanceMetrics {
    const metric: PerformanceMetrics = {
      operation,
      startTime: Date.now(),
      memoryBefore: this.getMemoryUsage(),
      metadata
    };
    
    this.metrics.push(metric);
    
    // Keep only the last MAX_METRICS entries
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }
    
    return metric;
  }
  
  /**
   * Ends performance monitoring for an operation.
   * 
   * @param metric - Performance metrics object from startOperation
   * @param elementsProcessed - Number of elements processed
   */
  static endOperation(metric: PerformanceMetrics, elementsProcessed?: number): void {
    const endTime = Date.now();
    metric.endTime = endTime;
    metric.duration = endTime - metric.startTime;
    metric.memoryAfter = this.getMemoryUsage();
    metric.elementsProcessed = elementsProcessed;
    
    // Log performance if operation takes longer than threshold
    if (metric.duration > CONFIG.PERFORMANCE.SLOW_OPERATION_THRESHOLD) {
      console.warn(`Slow operation detected: ${metric.operation} took ${metric.duration}ms`);
    }
  }
  
  /**
   * Executes a function with performance monitoring.
   * 
   * @param operation - Name of the operation
   * @param fn - Function to execute
   * @param elementsCount - Number of elements being processed
   * @returns Result of the function execution
   */
  static async monitor<T>(
    operation: string, 
    fn: () => Promise<T>, 
    elementsCount?: number
  ): Promise<T> {
    const metric = this.startOperation(operation, { elementsCount });
    try {
      const result = await fn();
      this.endOperation(metric, elementsCount);
      return result;
    } catch (error) {
      this.endOperation(metric, elementsCount);
      throw error;
    }
  }
  
  /**
   * Gets memory usage estimation (simplified for Figma plugin environment).
   * 
   * @returns Estimated memory usage
   */
  private static getMemoryUsage(): number {
    // Simplified memory estimation since we don't have full access to performance.memory
    return Date.now() % 1000000; // Placeholder value
  }
  
  /**
   * Gets performance summary for recent operations.
   * 
   * @returns Array of performance metrics
   */
  static getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }
  
  /**
   * Gets performance statistics for a specific operation.
   * 
   * @param operation - Operation name to analyze
   * @returns Performance statistics
   */
  static getOperationStats(operation: string): {
    count: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    totalElements: number;
  } {
    const operationMetrics = this.metrics.filter(m => m.operation === operation && m.duration);
    
    if (operationMetrics.length === 0) {
      return { count: 0, avgDuration: 0, minDuration: 0, maxDuration: 0, totalElements: 0 };
    }
    
    const durations = operationMetrics.map(m => m.duration!);
    const elements = operationMetrics.map(m => m.elementsProcessed || 0);
    
    return {
      count: operationMetrics.length,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      totalElements: elements.reduce((a, b) => a + b, 0)
    };
  }
  
  /**
   * Clears performance metrics.
   */
  static clearMetrics(): void {
    this.metrics = [];
  }
}

// ========================================================================================
// PERFORMANCE OPTIMIZATION & CACHING
// ========================================================================================
// This section contains performance optimizations and caching mechanisms to reduce
// processing time and improve user experience.

/**
 * Simple cache implementation for expensive operations
 */
class PerformanceCache {
  private static cache = new Map<string, { data: unknown; timestamp: number }>();
  
  static set<T>(key: string, data: T, ttl: number = CONFIG.PERFORMANCE.CACHE_DURATION): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now() + ttl
    });
  }
  
  static get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.timestamp) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }
  
  static has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.timestamp) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
  
  static clear(): void {
    this.cache.clear();
  }
  
  static invalidatePattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Debounce utility to prevent excessive function calls
 */
class Debouncer {
  private static timers = new Map<string, NodeJS.Timeout>();
  
  static debounce<T extends (...args: unknown[]) => unknown>(
    key: string,
    fn: T,
    delay: number = CONFIG.PERFORMANCE.DEBOUNCE_DELAY
  ): (...args: Parameters<T>) => void {
    return (...args: Parameters<T>) => {
      const existingTimer = this.timers.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      
      const timer = setTimeout(() => {
        fn(...args);
        this.timers.delete(key);
      }, delay);
      
      this.timers.set(key, timer);
    };
  }
  
  static cancel(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }
}

/**
 * Optimized serializer for large objects with compression and chunking
 */
class _OptimizedSerializer {
  /**
   * Serialize large objects efficiently with chunking
   */
  static serializeChunked(obj: unknown, maxChunkSize: number = 50000): string[] {
    const jsonString = JSON.stringify(obj);
    const chunks: string[] = [];
    
    for (let i = 0; i < jsonString.length; i += maxChunkSize) {
      chunks.push(jsonString.slice(i, i + maxChunkSize));
    }
    
    return chunks;
  }
  
  /**
   * Deserialize chunked object data
   */
  static deserializeChunked(chunks: string[]): unknown {
    const jsonString = chunks.join('');
    return JSON.parse(jsonString);
  }
  
  /**
   * Smart serialization that only includes changed properties
   */
  static serializeDelta(previous: Record<string, unknown>, current: Record<string, unknown>): Record<string, unknown> {
    const delta: Record<string, unknown> = {};
    
    for (const key in current) {
      if (current[key] !== previous?.[key]) {
        delta[key] = current[key];
      }
    }
    
    return delta;
  }
}

/**
 * Optimized element collector with caching and incremental updates
 */
class OptimizedCollector {
  private static lastScanTime = 0;
  private static documentHash = '';
  private static elementCache = new Map<string, DesignSystemElement>();
  
  /**
   * Generate a hash of the document structure for change detection
   */
  private static async getDocumentHash(): Promise<string> {
    // Ensure pages are loaded before accessing children
    await figma.loadAllPagesAsync();
    
    const pages = figma.root.children.map(page => ({
      id: page.id,
      name: page.name,
      childCount: page.children.length
    }));
    return hashObject(pages);
  }
  
  /**
   * Check if a full rescan is needed
   */
  static async needsFullRescan(): Promise<boolean> {
    const currentHash = await this.getDocumentHash();
    const hashChanged = currentHash !== this.documentHash;
    const timeElapsed = Date.now() - this.lastScanTime > CONFIG.PERFORMANCE.CACHE_DURATION;
    
    if (hashChanged) {
      this.documentHash = currentHash;
      return true;
    }
    
    return timeElapsed;
  }
  
  /**
   * Optimized collection with smart caching and incremental scanning
   */
  static async collectOptimized(): Promise<DesignSystemElement[]> {
    const cacheKey = `elements_${this.documentHash}`;
    
    // Try cache first
    if (!(await this.needsFullRescan())) {
      const cached = PerformanceCache.get<DesignSystemElement[]>(cacheKey);
      if (cached) {
        Logger.debug('Using cached design system elements', 'optimization');
        return cached;
      }
    }
    
    // Check if we should use incremental scanning
    const totalElements = await this.estimateElementCount();
    
    let elements: DesignSystemElement[];
    if (totalElements > CONFIG.PERFORMANCE.INCREMENTAL_SCAN_THRESHOLD) {
      elements = await this.collectIncremental();
    } else {
      elements = await this.collectWithBatching();
    }
    
    // Cache results
    PerformanceCache.set(cacheKey, elements);
    this.lastScanTime = Date.now();
    
    return elements;
  }
  
  /**
   * Estimate total element count for deciding scan strategy
   */
  private static async estimateElementCount(): Promise<number> {
    try {
      // Ensure pages are loaded before accessing children
      await this.ensurePagesLoaded();
      
      const pages = figma.root.children;
      let estimate = 0;
      
      for (const page of pages) {
        estimate += page.children.length * 10; // Rough estimate
      }
      
      return estimate;
    } catch {
      return 0;
    }
  }
  
  /**
   * Incremental collection for large documents
   */
  private static async collectIncremental(): Promise<DesignSystemElement[]> {
    Logger.info('Using incremental scanning for large document', 'optimization');
    const elements: DesignSystemElement[] = [];
    const batchSize = Math.floor(CONFIG.PERFORMANCE.BATCH_SIZE / 2); // Smaller batches for large docs
    
    // Load pages only once
    await this.ensurePagesLoaded();
    
    // Process each page separately to prevent memory issues
    for (const page of figma.root.children) {
      try {
        // Set current page for faster operations
        await figma.setCurrentPageAsync(page);
        
        const pageElements = await this.collectPageElements(page, batchSize);
        elements.push(...pageElements);
        
        // Yield control to prevent blocking
        await new Promise(resolve => setTimeout(resolve, 10));
        
      } catch (error) {
        Logger.warn(`Failed to process page ${page.name}: ${error}`, 'optimization');
      }
    }
    
    // Collect document-level elements (styles, variables)
    const documentElements = await this.collectDocumentElements();
    elements.push(...documentElements);
    
    return elements;
  }
  
  /**
   * Collect elements from a specific page
   */
  private static async collectPageElements(page: PageNode, batchSize: number): Promise<DesignSystemElement[]> {
    const elements: DesignSystemElement[] = [];
    
    // Find components in batches
    const components = page.findAllWithCriteria({ types: ['COMPONENT'] });
    for (let i = 0; i < components.length; i += batchSize) {
      const batch = components.slice(i, i + batchSize);
      const batchElements = await this.processBatch(batch, 'component');
      elements.push(...batchElements);
      
      if (i % (batchSize * 3) === 0) {
        await new Promise(resolve => setTimeout(resolve, 5));
      }
    }
    
    // Find component sets in batches
    const componentSets = page.findAllWithCriteria({ types: ['COMPONENT_SET'] });
    for (let i = 0; i < componentSets.length; i += batchSize) {
      const batch = componentSets.slice(i, i + batchSize);
      const batchElements = await this.processBatch(batch, 'componentSet');
      elements.push(...batchElements);
      
      if (i % (batchSize * 3) === 0) {
        await new Promise(resolve => setTimeout(resolve, 5));
      }
    }
    
    return elements;
  }
  
  /**
   * Collect elements with batching for medium-sized documents
   */
  private static async collectWithBatching(): Promise<DesignSystemElement[]> {
    Logger.info('Using batched scanning for document', 'optimization');
    const batchSize = CONFIG.PERFORMANCE.BATCH_SIZE;
    const elements: DesignSystemElement[] = [];
    
    // Load pages only once
    await this.ensurePagesLoaded();
    
    // Collect components in batches
    const components = figma.root.findAllWithCriteria({ types: ['COMPONENT'] });
    for (let i = 0; i < components.length; i += batchSize) {
      const batch = components.slice(i, i + batchSize);
      const batchElements = await this.processBatch(batch, 'component');
      elements.push(...batchElements);
      
      // Yield control periodically
      if (i % (batchSize * 2) === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    // Collect component sets in batches
    const componentSets = figma.root.findAllWithCriteria({ types: ['COMPONENT_SET'] });
    for (let i = 0; i < componentSets.length; i += batchSize) {
      const batch = componentSets.slice(i, i + batchSize);
      const batchElements = await this.processBatch(batch, 'componentSet');
      elements.push(...batchElements);
      
      if (i % (batchSize * 2) === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    // Collect document-level elements
    const documentElements = await this.collectDocumentElements();
    elements.push(...documentElements);
    
    return elements;
  }
  
  /**
   * Ensure pages are loaded with caching
   */
  private static async ensurePagesLoaded(): Promise<void> {
    const cacheKey = 'pages_loaded';
    if (!PerformanceCache.has(cacheKey)) {
      await figma.loadAllPagesAsync();
      PerformanceCache.set(cacheKey, true, 60000); // Cache for 1 minute
    }
  }
  
  /**
   * Process a batch of nodes efficiently
   */
  private static async processBatch(
    nodes: SceneNode[], 
    type: 'component' | 'componentSet'
  ): Promise<DesignSystemElement[]> {
    const elements: DesignSystemElement[] = [];
    
    for (const node of nodes) {
      try {
        // Check cache first
        const cacheKey = `${type}_${node.id}_${(node as FrameNode).width || 0}`;
        let element = this.elementCache.get(cacheKey);
        
        if (!element) {
          const serializedProperties = await serializeSceneNodeProperties(node);
          element = {
            id: node.id,
            name: node.name,
            type: type,
            key: (node as ComponentNode | ComponentSetNode).key,
            description: (node as ComponentNode | ComponentSetNode).description,
            parentName: type === 'component' && node.parent?.type === 'COMPONENT_SET' 
              ? node.parent.name : undefined,
            ...serializedProperties
          };
          
          // Cache the element
          this.elementCache.set(cacheKey, element);
        }
        
        elements.push(element);
      } catch (error) {
        Logger.warn(`Failed to process ${type} ${node.name}: ${error}`, 'optimization');
      }
    }
    
    return elements;
  }
  
  /**
   * Collect document-level elements (styles, variables)
   */
  private static async collectDocumentElements(): Promise<DesignSystemElement[]> {
    const cacheKey = 'document_elements';
    const cached = PerformanceCache.get<DesignSystemElement[]>(cacheKey);
    if (cached) {
      return cached;
    }
    
    const elements: DesignSystemElement[] = [];
    
    // Collect all style types in parallel
    const [textStyles, paintStyles, effectStyles] = await Promise.all([
      figma.getLocalTextStylesAsync(),
      figma.getLocalPaintStylesAsync(),
      figma.getLocalEffectStylesAsync()
    ]);
    
    // Process styles efficiently
    for (const style of textStyles) {
      elements.push({
        id: style.id,
        name: style.name,
        type: 'textStyle',
        key: style.key,
        description: style.description,
        ...serializeBaseStyleProperties(style)
      });
    }
    
    for (const style of paintStyles) {
      elements.push({
        id: style.id,
        name: style.name,
        type: 'colorStyle',
        key: style.key,
        description: style.description,
        ...serializeBaseStyleProperties(style)
      });
    }
    
    for (const style of effectStyles) {
      elements.push({
        id: style.id,
        name: style.name,
        type: 'colorStyle',
        key: style.key,
        description: style.description,
        ...serializeBaseStyleProperties(style)
      });
    }
    
    // Collect variables
    const [collections, localVariables] = await Promise.all([
      figma.variables.getLocalVariableCollectionsAsync(),
      figma.variables.getLocalVariablesAsync()
    ]);
    
    // Process collections
    for (const collection of collections) {
      elements.push({
        id: collection.id,
        name: collection.name,
        type: 'variableCollection',
        key: collection.key,
        variableDefinitionHash: hashObject({
          name: collection.name,
          modes: collection.modes,
          defaultModeId: collection.defaultModeId,
          remote: collection.remote,
          hiddenFromPublishing: collection.hiddenFromPublishing,
        })
      });
    }
    
    // Process variables
    for (const variable of localVariables) {
      elements.push({
        id: variable.id,
        name: variable.name,
        type: 'variable',
        key: variable.key,
        description: variable.description,
        variableDefinitionHash: serializeVariableProperties(variable)
      });
    }
    
    PerformanceCache.set(cacheKey, elements, 60000); // Cache for 1 minute
    return elements;
  }
  
  /**
   * Clear all caches
   */
  static clearCache(): void {
    this.elementCache.clear();
    PerformanceCache.clear();
  }
}

// ========================================================================================
// UTILITY FUNCTIONS
// ========================================================================================
// This section contains core utility functions for hashing, validation, and data
// processing that are used throughout the plugin.

/**
 * Generates a hash string using the djb2 algorithm.
 * This fast hashing function is used for change detection and data integrity.
 * 
 * @param str - The input string to hash
 * @returns A hexadecimal hash string
 */
function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) + hash) + char;
  }
  return hash.toString(16);
}

/**
 * Creates a hash for any object by serializing it to JSON.
 * Used for comparing complex objects for changes.
 * 
 * @param obj - The object to hash
 * @returns A hash string, or empty string if object is null/undefined
 */
function hashObject(obj: unknown): string {
  if (!obj) return '';
  return simpleHash(JSON.stringify(obj));
}

// ========================================================================================
// VALIDATION & TYPE GUARDS  
// ========================================================================================
// This section provides validation functions and type guards for ensuring data integrity
// and type safety throughout the plugin.

/**
 * Type guard that validates if an unknown object is a DesignSystemElement.
 * Ensures the object has required properties with correct types.
 * 
 * @param element - The object to validate
 * @returns True if the object is a valid DesignSystemElement
 */
function validateDesignSystemElement(element: unknown): element is DesignSystemElement {
  return element !== null &&
         typeof element === 'object' &&
         element !== undefined &&
         'id' in element &&
         'name' in element &&
         'type' in element &&
         typeof (element as Record<string, unknown>).id === 'string' &&
         typeof (element as Record<string, unknown>).name === 'string' &&
         typeof (element as Record<string, unknown>).type === 'string';
}

/**
 * Type guard that validates if an unknown object is valid TrackingData.
 * Checks structure and validates all contained elements.
 * 
 * @param data - The object to validate
 * @returns True if the object is valid TrackingData
 */
function validateTrackingData(data: unknown): data is TrackingData {
  return data !== null &&
         data !== undefined &&
         typeof data === 'object' &&
         'timestamp' in data &&
         'elements' in data &&
         typeof (data as Record<string, unknown>).timestamp === 'number' &&
         Array.isArray((data as Record<string, unknown>).elements) &&
         ((data as Record<string, unknown>).elements as unknown[]).every(validateDesignSystemElement);
}

/**
 * Type guard that validates if an unknown object represents valid Changes.
 * Ensures all change categories contain valid elements.
 * 
 * @param changes - The object to validate
 * @returns True if the object represents valid Changes
 */
function validateChanges(changes: unknown): changes is Changes {
  return changes !== null &&
         changes !== undefined &&
         typeof changes === 'object' &&
         'added' in changes &&
         'modified' in changes &&
         'removed' in changes &&
         Array.isArray((changes as Record<string, unknown>).added) &&
         Array.isArray((changes as Record<string, unknown>).modified) &&
         Array.isArray((changes as Record<string, unknown>).removed) &&
         ((changes as Record<string, unknown>).added as unknown[]).every(validateDesignSystemElement) &&
         ((changes as Record<string, unknown>).modified as unknown[]).every(validateDesignSystemElement) &&
         ((changes as Record<string, unknown>).removed as unknown[]).every(validateDesignSystemElement);
}

/**
 * Enhanced validation result with detailed error information.
 */
interface ValidationResult {
  /** Whether validation passed */
  isValid: boolean;
  
  /** Array of validation errors */
  errors: string[];
  
  /** Array of validation warnings */
  warnings: string[];
}

/**
 * Enhanced validation for DesignSystemElement with detailed error reporting.
 * 
 * @param element - The element to validate
 * @param context - Context for error reporting
 * @returns Detailed validation result
 */
function validateDesignSystemElementDetailed(element: unknown, context = 'element'): ValidationResult {
  const result: ValidationResult = { isValid: true, errors: [], warnings: [] };
  
  if (!element) {
    result.errors.push(`${context} is null or undefined`);
    result.isValid = false;
    return result;
  }
  
  if (typeof element !== 'object') {
    result.errors.push(`${context} must be an object, got ${typeof element}`);
    result.isValid = false;
    return result;
  }
  
  const obj = element as Record<string, unknown>;
  
  // Required fields validation
  if (!('id' in obj)) {
    result.errors.push(`${context} missing required field: id`);
    result.isValid = false;
  } else if (typeof obj.id !== 'string') {
    result.errors.push(`${context}.id must be a string, got ${typeof obj.id}`);
    result.isValid = false;
  } else if (obj.id.length === 0) {
    result.errors.push(`${context}.id cannot be empty`);
    result.isValid = false;
  }
  
  if (!('name' in obj)) {
    result.errors.push(`${context} missing required field: name`);
    result.isValid = false;
  } else if (typeof obj.name !== 'string') {
    result.errors.push(`${context}.name must be a string, got ${typeof obj.name}`);
    result.isValid = false;
  } else if (obj.name.length === 0) {
    result.warnings.push(`${context}.name is empty`);
  }
  
  if (!('type' in obj)) {
    result.errors.push(`${context} missing required field: type`);
    result.isValid = false;
  } else if (typeof obj.type !== 'string') {
    result.errors.push(`${context}.type must be a string, got ${typeof obj.type}`);
    result.isValid = false;
  } else {
    const validTypes = ['component', 'componentSet', 'textStyle', 'colorStyle', 'variable', 'variableCollection'];
    if (!validTypes.includes(obj.type)) {
      result.errors.push(`${context}.type must be one of: ${validTypes.join(', ')}, got "${obj.type}"`);
      result.isValid = false;
    }
  }
  
  // Optional fields validation
  if ('key' in obj && obj.key !== undefined && typeof obj.key !== 'string') {
    result.errors.push(`${context}.key must be a string or undefined, got ${typeof obj.key}`);
    result.isValid = false;
  }
  
  if ('description' in obj && obj.description !== undefined && typeof obj.description !== 'string') {
    result.errors.push(`${context}.description must be a string or undefined, got ${typeof obj.description}`);
    result.isValid = false;
  }
  
  // Timestamp validation
  if ('modifiedAt' in obj && obj.modifiedAt !== undefined) {
    if (typeof obj.modifiedAt !== 'number') {
      result.errors.push(`${context}.modifiedAt must be a number, got ${typeof obj.modifiedAt}`);
      result.isValid = false;
    } else if (obj.modifiedAt < 0 || obj.modifiedAt > Date.now() + 86400000) { // Allow 1 day in future
      result.warnings.push(`${context}.modifiedAt timestamp seems invalid: ${obj.modifiedAt}`);
    }
  }
  
  return result;
}

/**
 * Enhanced validation for TrackingData with detailed error reporting.
 * 
 * @param data - The data to validate
 * @returns Detailed validation result
 */
function validateTrackingDataDetailed(data: unknown): ValidationResult {
  const result: ValidationResult = { isValid: true, errors: [], warnings: [] };
  
  if (!data || typeof data !== 'object') {
    result.errors.push('TrackingData must be a non-null object');
    result.isValid = false;
    return result;
  }
  
  const obj = data as Record<string, unknown>;
  
  // Validate timestamp
  if (!('timestamp' in obj)) {
    result.errors.push('TrackingData missing required field: timestamp');
    result.isValid = false;
  } else if (typeof obj.timestamp !== 'number') {
    result.errors.push(`TrackingData.timestamp must be a number, got ${typeof obj.timestamp}`);
    result.isValid = false;
  } else if (obj.timestamp < 0 || obj.timestamp > Date.now() + 86400000) {
    result.warnings.push(`TrackingData.timestamp seems invalid: ${obj.timestamp}`);
  }
  
  // Validate elements array
  if (!('elements' in obj)) {
    result.errors.push('TrackingData missing required field: elements');
    result.isValid = false;
  } else if (!Array.isArray(obj.elements)) {
    result.errors.push(`TrackingData.elements must be an array, got ${typeof obj.elements}`);
    result.isValid = false;
  } else {
    // Validate each element
    obj.elements.forEach((element, index) => {
      const elementResult = validateDesignSystemElementDetailed(element, `elements[${index}]`);
      result.errors.push(...elementResult.errors);
      result.warnings.push(...elementResult.warnings);
      if (!elementResult.isValid) {
        result.isValid = false;
      }
    });
    
    if (obj.elements.length > CONFIG.LIMITS.MAX_ELEMENTS_PER_SCAN) {
      result.warnings.push(`TrackingData contains ${obj.elements.length} elements, which exceeds recommended limit of ${CONFIG.LIMITS.MAX_ELEMENTS_PER_SCAN}`);
    }
  }
  
  return result;
}

// ========================================================================================
// LOGGING & MONITORING
// ========================================================================================
// This section provides comprehensive logging and monitoring capabilities for debugging,
// performance tracking, and operational insights.

/**
 * Log levels for categorizing messages.
 */
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

/**
 * Structured log entry interface.
 */
interface LogEntry {
  /** Timestamp of the log entry */
  timestamp: number;
  
  /** Log level */
  level: LogLevel;
  
  /** Log message */
  message: string;
  
  /** Context or category */
  context: string;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  
  /** Performance metrics if applicable */
  performance?: {
    duration?: number;
    elementsProcessed?: number;
  };
}

/**
 * Advanced logging system with structured logging, filtering, and monitoring.
 */
class Logger {
  private static logs: LogEntry[] = [];
  private static readonly MAX_LOGS = 500;
  private static currentLogLevel = LogLevel.INFO;
  
  /**
   * Sets the minimum log level for output.
   * 
   * @param level - Minimum log level to output
   */
  static setLogLevel(level: LogLevel): void {
    this.currentLogLevel = level;
  }
  
  /**
   * Logs a debug message.
   * 
   * @param message - Debug message
   * @param context - Context or category
   * @param metadata - Additional metadata
   */
  static debug(message: string, context = 'general', metadata?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context, metadata);
  }
  
  /**
   * Logs an info message.
   * 
   * @param message - Info message
   * @param context - Context or category
   * @param metadata - Additional metadata
   */
  static info(message: string, context = 'general', metadata?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context, metadata);
  }
  
  /**
   * Logs a warning message.
   * 
   * @param message - Warning message
   * @param context - Context or category
   * @param metadata - Additional metadata
   */
  static warn(message: string, context = 'general', metadata?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context, metadata);
  }
  
  /**
   * Logs an error message.
   * 
   * @param message - Error message
   * @param context - Context or category
   * @param metadata - Additional metadata
   */
  static error(message: string, context = 'general', metadata?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context, metadata);
  }
  
  /**
   * Logs a performance metric.
   * 
   * @param operation - Operation name
   * @param duration - Duration in milliseconds
   * @param elementsProcessed - Number of elements processed
   * @param context - Context or category
   */
  static performance(operation: string, duration: number, elementsProcessed?: number, context = 'performance'): void {
    this.log(LogLevel.INFO, `Operation '${operation}' completed`, context, {
      operation,
      performance: { duration, elementsProcessed }
    });
  }
  
  /**
   * Internal logging method.
   * 
   * @param level - Log level
   * @param message - Log message
   * @param context - Context or category
   * @param metadata - Additional metadata
   */
  private static log(level: LogLevel, message: string, context: string, metadata?: Record<string, unknown>): void {
    if (level < this.currentLogLevel) {
      return;
    }
    
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      context,
      metadata
    };
    
    this.logs.push(entry);
    
    // Keep only the last MAX_LOGS entries
    if (this.logs.length > this.MAX_LOGS) {
      this.logs = this.logs.slice(-this.MAX_LOGS);
    }
    
    // Output to console based on level
    const logMessage = `[${LogLevel[level]}] ${context}: ${message}`;
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(logMessage, metadata);
        break;
      case LogLevel.INFO:
        console.info(logMessage, metadata);
        break;
      case LogLevel.WARN:
        console.warn(logMessage, metadata);
        break;
      case LogLevel.ERROR:
        console.error(logMessage, metadata);
        break;
    }
  }
  
  /**
   * Gets all log entries.
   * 
   * @returns Array of log entries
   */
  static getLogs(): LogEntry[] {
    return [...this.logs];
  }
  
  /**
   * Gets log entries filtered by level.
   * 
   * @param level - Minimum log level to include
   * @returns Filtered log entries
   */
  static getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level >= level);
  }
  
  /**
   * Gets log entries filtered by context.
   * 
   * @param context - Context to filter by
   * @returns Filtered log entries
   */
  static getLogsByContext(context: string): LogEntry[] {
    return this.logs.filter(log => log.context === context);
  }
  
  /**
   * Clears all log entries.
   */
  static clearLogs(): void {
    this.logs = [];
  }
  
  /**
   * Exports logs as JSON string.
   * 
   * @returns JSON string of all logs
   */
  static exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// ========================================================================================
// DATA COMPRESSION & OPTIMIZATION
// ========================================================================================
// This section handles data compression and optimization for efficient storage within
// Figma's plugin data limits.

/**
 * Compresses tracking data for efficient storage by using shorter property names.
 * This reduces the storage footprint and helps stay within Figma's storage limits.
 * 
 * @param data - The tracking data to compress
 * @returns Compressed data with shortened property names
 */
function compressDataForStorage(data: TrackingData): Record<string, unknown> {
  const compressionMap = {
    timestamp: 't', id: 'i', name: 'n', type: 'ty', key: 'k', description: 'd',
    variantProperties: 'vp', variantPropertiesHash: 'vh', parentName: 'pn',
    modifiedAt: 'ma', updatedAt: 'ua', fillsHash: 'fh', strokesHash: 'sh',
    effectsHash: 'eh', propertiesHash: 'ph', componentPropertiesHash: 'ch',
    childrenIds: 'ci', structureHash: 'st', layoutHash: 'lh', geometryHash: 'gh',
    appearanceHash: 'ah', borderHash: 'bh', typographyHash: 'th',
    variableUsageHash: 'vu', variableDefinitionHash: 'vd', interactionHash: 'ih',
    instanceOverridesHash: 'io', exposedPropertiesHash: 'ep', nestedContentHash: 'nc'
  };

  return {
    t: data.timestamp,
    e: data.elements.map(element => {
      const compressed: Record<string, unknown> = {};
      Object.entries(element).forEach(([key, value]) => {
        const compressedKey = compressionMap[key as keyof typeof compressionMap] || key;
        compressed[compressedKey] = value;
      });
      return compressed;
    })
  };
}

/**
 * Decompresses tracking data from storage by restoring original property names.
 * Reverses the compression process to return usable tracking data.
 * 
 * @param compressedData - The compressed data from storage
 * @returns Decompressed tracking data with full property names
 */
function decompressDataFromStorage(compressedData: Record<string, unknown>): TrackingData {
  const decompressionMap = {
    t: 'timestamp', i: 'id', n: 'name', ty: 'type', k: 'key', d: 'description',
    vp: 'variantProperties', vh: 'variantPropertiesHash', pn: 'parentName',
    ma: 'modifiedAt', ua: 'updatedAt', fh: 'fillsHash', sh: 'strokesHash',
    eh: 'effectsHash', ph: 'propertiesHash', ch: 'componentPropertiesHash',
    ci: 'childrenIds', st: 'structureHash', lh: 'layoutHash', gh: 'geometryHash',
    ah: 'appearanceHash', bh: 'borderHash', th: 'typographyHash',
    vu: 'variableUsageHash', vd: 'variableDefinitionHash', ih: 'interactionHash',
    io: 'instanceOverridesHash', ep: 'exposedPropertiesHash', nc: 'nestedContentHash'
  };

  return {
    timestamp: compressedData.t as number,
    elements: (compressedData.e as Array<Record<string, unknown>>).map((element) => {
      const decompressed: Record<string, unknown> = {};
      Object.entries(element).forEach(([key, value]) => {
        const decompressedKey = decompressionMap[key as keyof typeof decompressionMap] || key;
        decompressed[decompressedKey] = value;
      });
      return decompressed as unknown as DesignSystemElement;
    })
  };
}

// ========================================================================================
// DATA STORAGE & PERSISTENCE
// ========================================================================================
// This section handles all data storage operations, including compression, chunking,
// and retrieval of tracking data from Figma's shared plugin data storage.

/**
 * Retrieves stored tracking data from Figma's shared plugin data storage.
 * Supports both chunked and non-chunked data for handling large datasets
 * that exceed Figma's storage limits.
 * 
 * @returns The stored tracking data or null if not found or invalid
 */
function getStoredTrackingData(): TrackingData | null {
  try {
    const metadataStr = figma.root.getSharedPluginData(PLUGIN_NAMESPACE, TRACKING_DATA_KEY + '_meta');
    
    if (!metadataStr || metadataStr.trim() === '') {
      return null;
    }
    
    const metadata = JSON.parse(metadataStr);
    let reconstructedDataStr = '';
    
    // Reconstruct data from chunks
    for (let i = 0; i < metadata.chunkCount; i++) {
      const chunkKey = TRACKING_DATA_KEY + '_chunk_' + i;
      const chunkData = figma.root.getSharedPluginData(PLUGIN_NAMESPACE, chunkKey);
      if (!chunkData) {
        console.error('Missing chunk', i);
        return null;
      }
      reconstructedDataStr += chunkData;
    }
    
    const compressedData = JSON.parse(reconstructedDataStr);
    const data = decompressDataFromStorage(compressedData);
    
    if (!validateTrackingData(data)) {
      console.warn('Invalid tracking data format detected');
      clearStoredTrackingData();
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error retrieving stored data:', error);
    clearStoredTrackingData();
    return null;
  }
}

/**
 * Stores tracking data to Figma's shared plugin data storage.
 * Automatically chunks data if it exceeds size limits to ensure reliable storage.
 * 
 * @param data - The tracking data to store
 * @throws Error if storage operation fails
 */
function setStoredTrackingData(data: TrackingData): void {
  try {
    clearStoredTrackingData();
    
    const compressedData = compressDataForStorage(data);
    const dataStr = JSON.stringify(compressedData);
    
    if (dataStr.length <= CHUNK_SIZE_LIMIT) {
      // Store as single chunk
      figma.root.setSharedPluginData(PLUGIN_NAMESPACE, TRACKING_DATA_KEY + '_chunk_0', dataStr);
      figma.root.setSharedPluginData(PLUGIN_NAMESPACE, TRACKING_DATA_KEY + '_meta', 
        JSON.stringify({ chunkCount: 1 }));
    } else {
      // Split into multiple chunks
      const chunks = [];
      for (let i = 0; i < dataStr.length; i += CHUNK_SIZE_LIMIT) {
        chunks.push(dataStr.slice(i, i + CHUNK_SIZE_LIMIT));
      }
      
      chunks.forEach((chunk, index) => {
        const chunkKey = TRACKING_DATA_KEY + '_chunk_' + index;
        figma.root.setSharedPluginData(PLUGIN_NAMESPACE, chunkKey, chunk);
      });
      
      figma.root.setSharedPluginData(PLUGIN_NAMESPACE, TRACKING_DATA_KEY + '_meta', 
        JSON.stringify({ chunkCount: chunks.length }));
    }
    
  } catch (error) {
    console.error('Error storing data:', error);
    throw new Error('Failed to store tracking data: ' + error);
  }
}

/**
 * Removes all stored tracking data from Figma's shared plugin data storage.
 * Clears both metadata and all data chunks.
 */
function clearStoredTrackingData(): void {
  try {
    const metadataStr = figma.root.getSharedPluginData(PLUGIN_NAMESPACE, TRACKING_DATA_KEY + '_meta');
    
    if (metadataStr && metadataStr.trim() !== '') {
      const metadata = JSON.parse(metadataStr);
      for (let i = 0; i < metadata.chunkCount; i++) {
        const chunkKey = TRACKING_DATA_KEY + '_chunk_' + i;
        figma.root.setSharedPluginData(PLUGIN_NAMESPACE, chunkKey, '');
      }
    }
    
    figma.root.setSharedPluginData(PLUGIN_NAMESPACE, TRACKING_DATA_KEY + '_meta', '');
  } catch (error) {
    console.error('Error clearing stored data:', error);
  }
}

// ========================================================================================
// SERIALIZATION & PROPERTY HASHING
// ========================================================================================
// This section contains functions for serializing Figma node properties into hashable
// strings for efficient change detection and comparison.

/**
 * Serializes paint properties (fills) into a hash for change detection.
 * Handles different paint types including solids, gradients, and images.
 * 
 * @param paints - Array of paint objects to serialize
 * @returns Hash string representing the paint properties
 */
function serializePaintProperties(paints: readonly Paint[]): string {
  if (!paints || paints.length === 0) return '';
  
  const paintData = paints.map(paint => ({
    type: paint.type,
    visible: paint.visible,
    opacity: paint.opacity,
    ...(paint.type === 'SOLID' && { color: paint.color }),
    ...(paint.type === 'GRADIENT_LINEAR' && { 
      gradientStops: paint.gradientStops,
      gradientTransform: paint.gradientTransform 
    }),
    ...(paint.type === 'IMAGE' && { imageHash: paint.imageHash }),
  }));
  
  return hashObject(paintData);
}

/**
 * Serializes stroke properties into a hash for change detection.
 * Includes stroke weight, alignment, caps, joins, and dash patterns.
 * 
 * @param node - The scene node to extract stroke properties from
 * @returns Hash string representing the stroke properties
 */
function serializeStrokeProperties(node: SceneNode): string {
  if (!('strokes' in node)) return '';
  
  const strokeData = {
    strokes: node.strokes,
    strokeWeight: 'strokeWeight' in node ? node.strokeWeight : undefined,
    strokeAlign: 'strokeAlign' in node ? node.strokeAlign : undefined,
    strokeCap: 'strokeCap' in node ? node.strokeCap : undefined,
    strokeJoin: 'strokeJoin' in node ? node.strokeJoin : undefined,
    strokeMiterLimit: 'strokeMiterLimit' in node ? node.strokeMiterLimit : undefined,
    dashPattern: 'dashPattern' in node ? node.dashPattern : undefined,
  };
  
  return hashObject(strokeData);
}

/**
 * Serializes visual effects (shadows, blurs) into a hash for change detection.
 * Handles different effect types with their specific properties.
 * 
 * @param effects - Array of effect objects to serialize
 * @returns Hash string representing the effect properties
 */
function serializeEffectProperties(effects: readonly Effect[]): string {
  if (!effects || effects.length === 0) return '';
  
  const effectData = effects.map(effect => ({
    type: effect.type,
    visible: effect.visible,
    ...(effect.type === 'DROP_SHADOW' && {
      color: effect.color,
      offset: effect.offset,
      radius: effect.radius,
      spread: effect.spread,
      blendMode: effect.blendMode,
    }),
    ...((effect.type === 'LAYER_BLUR' || effect.type === 'BACKGROUND_BLUR') && { 
      radius: effect.radius 
    }),
  }));
  
  return hashObject(effectData);
}

/**
 * Serializes auto-layout properties into a hash for change detection.
 * Includes layout mode, sizing, alignment, spacing, and padding properties.
 * 
 * @param node - The scene node to extract layout properties from
 * @returns Hash string representing the layout properties
 */
function serializeLayoutProperties(node: SceneNode): string {
  if (!('layoutMode' in node)) return '';
  
  const layoutData = {
    layoutMode: node.layoutMode,
    primaryAxisSizingMode: 'primaryAxisSizingMode' in node ? node.primaryAxisSizingMode : undefined,
    counterAxisSizingMode: 'counterAxisSizingMode' in node ? node.counterAxisSizingMode : undefined,
    primaryAxisAlignItems: 'primaryAxisAlignItems' in node ? node.primaryAxisAlignItems : undefined,
    counterAxisAlignItems: 'counterAxisAlignItems' in node ? node.counterAxisAlignItems : undefined,
    itemSpacing: 'itemSpacing' in node ? node.itemSpacing : undefined,
    paddingLeft: 'paddingLeft' in node ? node.paddingLeft : undefined,
    paddingRight: 'paddingRight' in node ? node.paddingRight : undefined,
    paddingTop: 'paddingTop' in node ? node.paddingTop : undefined,
    paddingBottom: 'paddingBottom' in node ? node.paddingBottom : undefined,
  };
  
  return hashObject(layoutData);
}

/**
 * Serializes geometric properties into a hash for change detection.
 * Includes size, position, rotation, constraints, and corner radius properties.
 * 
 * @param node - The scene node to extract geometry properties from
 * @returns Hash string representing the geometry properties
 */
function serializeGeometryProperties(node: SceneNode): string {
  const geometryData = {
    width: node.width,
    height: node.height,
    x: node.x,
    y: node.y,
    rotation: 'rotation' in node ? node.rotation : undefined,
    constraints: 'constraints' in node ? node.constraints : undefined,
    cornerRadius: 'cornerRadius' in node ? node.cornerRadius : undefined,
    topLeftRadius: 'topLeftRadius' in node ? node.topLeftRadius : undefined,
    topRightRadius: 'topRightRadius' in node ? node.topRightRadius : undefined,
    bottomLeftRadius: 'bottomLeftRadius' in node ? node.bottomLeftRadius : undefined,
    bottomRightRadius: 'bottomRightRadius' in node ? node.bottomRightRadius : undefined,
  };
  
  return hashObject(geometryData);
}

/**
 * Serializes typography properties into a hash for change detection.
 * Only applies to text nodes and includes font, alignment, and spacing properties.
 * 
 * @param node - The scene node to extract typography properties from
 * @returns Hash string representing the typography properties, or empty string for non-text nodes
 */
function serializeTypographyProperties(node: SceneNode): string {
  if (node.type !== 'TEXT') return '';
  
  const textNode = node as TextNode;
  const typographyData = {
    characters: textNode.characters,
    fontSize: textNode.fontSize,
    fontName: textNode.fontName,
    fontWeight: textNode.fontWeight,
    textAlignHorizontal: textNode.textAlignHorizontal,
    textAlignVertical: textNode.textAlignVertical,
    textAutoResize: textNode.textAutoResize,
    textDecoration: textNode.textDecoration,
    textCase: textNode.textCase,
    lineHeight: textNode.lineHeight,
    letterSpacing: textNode.letterSpacing,
    paragraphIndent: textNode.paragraphIndent,
    paragraphSpacing: textNode.paragraphSpacing,
    textStyleId: textNode.textStyleId,
  };
  
  return hashObject(typographyData);
}

/**
 * Serializes component instance properties into a hash for change detection.
 * Includes main component reference, component properties, and overrides.
 * 
 * @param node - The instance node to extract properties from
 * @returns Promise resolving to hash string representing the instance properties
 */
async function serializeInstanceProperties(node: InstanceNode): Promise<string> {
  const mainComponent = await node.getMainComponentAsync();
  const instanceData = {
    mainComponent: mainComponent ? {
      id: mainComponent.id,
      name: mainComponent.name,
      key: mainComponent.key,
    } : null,
    componentProperties: node.componentProperties,
    overrides: node.overrides,
  };
  
  return hashObject(instanceData);
}

/**
 * Serializes design variable properties into a hash for change detection.
 * Includes name, description, type, values, and publishing settings.
 * 
 * @param variable - The variable to extract properties from
 * @returns Hash string representing the variable properties
 */
function serializeVariableProperties(variable: Variable): string {
  const variableData = {
    name: variable.name,
    description: variable.description,
    resolvedType: variable.resolvedType,
    valuesByMode: variable.valuesByMode,
    remote: variable.remote,
    key: variable.key,
    variableCollectionId: variable.variableCollectionId,
    scopes: variable.scopes,
    hiddenFromPublishing: variable.hiddenFromPublishing,
  };
  
  return hashObject(variableData);
}

// ========================================================================================
// DETAILED PROPERTY COMPARISON
// ========================================================================================
// This section provides detailed comparison and analysis functions for tracking specific
// property changes between design system elements.

/**
 * Converts RGB color values (0-1 range) to hexadecimal color format.
 * Used for creating human-readable color representations in change descriptions.
 * 
 * @param r - Red component (0-1)
 * @param g - Green component (0-1) 
 * @param b - Blue component (0-1)
 * @returns Hexadecimal color string in uppercase format (e.g., "#FF5733")
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Serializes fill/paint data into a human-readable format for detailed change comparison.
 * Converts complex paint objects into descriptive strings showing colors, gradients, and patterns.
 * 
 * @param paints - Array of paint objects to serialize
 * @returns Human-readable string describing the fills (e.g., "#FF5733", "linear gradient")
 */
function serializeFillDataDetailed(paints: readonly Paint[]): string {
  if (!paints || paints.length === 0) return 'None';
  
  return paints.map(paint => {
    if (paint.type === 'SOLID') {
      const color = paint.color;
      const hex = rgbToHex(color.r, color.g, color.b);
      const opacity = paint.opacity !== undefined ? paint.opacity : 1;
      return `${hex}${opacity < 1 ? ` ${Math.round(opacity * 100)}%` : ''}`;
    } else if (paint.type === 'GRADIENT_LINEAR' || paint.type === 'GRADIENT_RADIAL') {
      return `${paint.type.replace('GRADIENT_', '').toLowerCase()} gradient`;
    }
    return paint.type.toLowerCase().replace('_', ' ');
  }).join(', ');
}

/**
 * Serializes stroke properties into a human-readable format for detailed change comparison.
 * Combines stroke color and weight information into descriptive strings.
 * 
 * @param node - The scene node to extract stroke data from
 * @returns Human-readable string describing the stroke (e.g., "#FF5733, 2px" or "None")
 */
function serializeStrokeDataDetailed(node: SceneNode): string {
  if (!('strokes' in node)) return 'None';
  
  const strokes = node.strokes;
  const strokeWeight = 'strokeWeight' in node ? node.strokeWeight : 0;
  
  if (!strokes || strokes.length === 0 || strokeWeight === 0) return 'None';
  
  const strokeColor = serializeFillDataDetailed(strokes);
  return `${strokeColor}, ${String(strokeWeight)}px`;
}

/**
 * Serializes corner radius properties into a human-readable format for detailed change comparison.
 * Handles both uniform and mixed corner radius values with appropriate formatting.
 * 
 * @param node - The scene node to extract corner radius data from
 * @returns Human-readable string describing corner radius (e.g., "8px", "4/8/8/4px", or "None")
 */
function serializeCornerRadiusDetailed(node: SceneNode): string {
  if (!('cornerRadius' in node)) return 'None';
  
  const radius = node.cornerRadius;
  if (typeof radius === 'number') {
    return radius === 0 ? 'None' : `${radius}px`;
  }
  
  // Mixed radius
  const topLeft = 'topLeftRadius' in node ? node.topLeftRadius : 0;
  const topRight = 'topRightRadius' in node ? node.topRightRadius : 0;
  const bottomLeft = 'bottomLeftRadius' in node ? node.bottomLeftRadius : 0;
  const bottomRight = 'bottomRightRadius' in node ? node.bottomRightRadius : 0;
  
  if (topLeft === topRight && topRight === bottomLeft && bottomLeft === bottomRight) {
    return topLeft === 0 ? 'None' : `${topLeft}px`;
  }
  
  return `${topLeft}/${topRight}/${bottomRight}/${bottomLeft}px`;
}

/**
 * Serializes node dimensions into a human-readable format for detailed change comparison.
 * Formats width and height values with pixel units for clear presentation.
 * 
 * @param node - The scene node to extract size data from
 * @returns Human-readable string describing dimensions (e.g., "320×240px")
 */
function serializeSizeDataDetailed(node: SceneNode): string {
  return `${Math.round(node.width)}×${Math.round(node.height)}px`;
}

/**
 * Serializes visual effects into a human-readable format for detailed change comparison.
 * Converts shadow and blur effects into descriptive strings with color and measurement details.
 * 
 * @param effects - Array of effect objects to serialize
 * @returns Human-readable string describing effects (e.g., "Drop Shadow: #000000, blur 4px" or "None")
 */
function serializeEffectsDataDetailed(effects: readonly Effect[]): string {
  if (!effects || effects.length === 0) return 'None';
  
  return effects.map(effect => {
    if (effect.type === 'DROP_SHADOW') {
      const color = effect.color;
      const hex = rgbToHex(color.r, color.g, color.b);
      const opacity = color.a !== undefined ? color.a : 1;
      return `Drop Shadow: ${hex}${opacity < 1 ? ` ${Math.round(opacity * 100)}%` : ''}, blur ${effect.radius}px`;
    } else if (effect.type === 'LAYER_BLUR') {
      return `Layer Blur: ${effect.radius}px`;
    }
    return effect.type.toLowerCase().replace('_', ' ');
  }).join(', ');
}

/**
 * Serializes typography properties into a human-readable format for detailed change comparison.
 * Extracts font family and size information from text nodes for clear presentation.
 * 
 * @param node - The scene node to extract typography data from
 * @returns Human-readable string describing typography (e.g., "Inter, 16px" or "None" for non-text nodes)
 */
function serializeTypographyDataDetailed(node: SceneNode): string {
  if (node.type !== 'TEXT') return 'None';
  
  const textNode = node as TextNode;
  const fontName = typeof textNode.fontName === 'object' ? textNode.fontName.family : 'Mixed';
  const fontSize = typeof textNode.fontSize === 'number' ? textNode.fontSize : 'Mixed';
  
  return `${fontName}, ${fontSize}px`;
}

/**
 * Analyzes differences between two design system elements and creates detailed change descriptions.
 * Compares various properties like fills, strokes, effects, typography, and generates human-readable change info.
 * 
 * @param previous - The previous state of the element
 * @param current - The current state of the element  
 * @returns Array of detailed property changes with before/after values
 */
function analyzePropertyChanges(previous: DesignSystemElement, current: DesignSystemElement): PropertyChangeInfo[] {
  const changes: PropertyChangeInfo[] = [];
  
  // Compare fills
  if (previous.fillsData !== current.fillsData) {
    changes.push({
      property: 'fills',
      displayName: 'Fill',
      oldValue: previous.fillsData || 'None',
      newValue: current.fillsData || 'None',
      changeType: 'modified'
    });
  }
  
  // Compare strokes
  if (previous.strokesData !== current.strokesData) {
    changes.push({
      property: 'strokes',
      displayName: 'Stroke',
      oldValue: previous.strokesData || 'None',
      newValue: current.strokesData || 'None',
      changeType: 'modified'
    });
  }
  
  // Compare corner radius
  if (previous.cornerRadiusData !== current.cornerRadiusData) {
    changes.push({
      property: 'cornerRadius',
      displayName: 'Corner Radius',
      oldValue: previous.cornerRadiusData || 'None',
      newValue: current.cornerRadiusData || 'None',
      changeType: 'modified'
    });
  }
  
  // Compare size
  if (previous.sizeData !== current.sizeData) {
    changes.push({
      property: 'size',
      displayName: 'Size',
      oldValue: previous.sizeData || 'Unknown',
      newValue: current.sizeData || 'Unknown',
      changeType: 'modified'
    });
  }
  
  // Compare effects
  if (previous.effectsData !== current.effectsData) {
    changes.push({
      property: 'effects',
      displayName: 'Effects',
      oldValue: previous.effectsData || 'None',
      newValue: current.effectsData || 'None',
      changeType: 'modified'
    });
  }
  
  // Compare typography
  if (previous.typographyData !== current.typographyData) {
    changes.push({
      property: 'typography',
      displayName: 'Typography',
      oldValue: previous.typographyData || 'None',
      newValue: current.typographyData || 'None',
      changeType: 'modified'
    });
  }
  
  // Compare description
  if (previous.description !== current.description) {
    changes.push({
      property: 'description',
      displayName: 'Description',
      oldValue: previous.description || 'None',
      newValue: current.description || 'None',
      changeType: 'modified'
    });
  }
  
  return changes;
}

/**
 * Creates a concise summary of property changes for display purposes.
 * Formats multiple changes into a readable summary string with appropriate truncation.
 * 
 * @param changes - Array of property changes to summarize
 * @returns Formatted summary string describing the changes
 */
function createChangesSummary(changes: PropertyChangeInfo[]): string {
  if (changes.length === 0) return 'No specific changes detected';
  
  if (changes.length === 1) {
    const change = changes[0];
    return `${change.displayName}: ${change.oldValue} → ${change.newValue}`;
  }
  
  const changeTypes = changes.map(c => c.displayName).join(', ');
  return `Changed: ${changeTypes} (${changes.length} properties)`;
}

/**
 * Recursively traverses a node hierarchy to collect essential properties from all nested children.
 * Gathers visual and structural properties that are important for change detection and comparison.
 * 
 * @param node - The root scene node to start traversing from
 * @returns Array of property objects representing the node and all its children
 */
function traverseNodeProperties(node: SceneNode): Record<string, unknown>[] {
  const nodeData: Record<string, unknown> = {
    id: node.id,
    name: node.name,
    type: node.type,
    visible: node.visible,
    // Capture key visual properties that might change
    fills: 'fills' in node && node.fills !== figma.mixed ? 
      JSON.stringify(node.fills) : 'none',
    strokes: 'strokes' in node ? 
      JSON.stringify(node.strokes) : 'none',
    effects: 'effects' in node ? 
      JSON.stringify(node.effects) : 'none',
    fontSize: node.type === 'TEXT' ? (node as TextNode).fontSize : null,
    characters: node.type === 'TEXT' ? (node as TextNode).characters : null,
    fontName: node.type === 'TEXT' ? JSON.stringify((node as TextNode).fontName) : null,
    width: node.width,
    height: node.height,
    x: node.x,
    y: node.y,
    cornerRadius: 'cornerRadius' in node ? node.cornerRadius : null,
    strokeWeight: 'strokeWeight' in node ? node.strokeWeight : null,
  };

  const allData = [nodeData];
  
  // Recursively traverse children if they exist
  if ('children' in node && node.children.length > 0) {
    const childrenMixin = node as BaseNode & ChildrenMixin;
    for (const child of childrenMixin.children) {
      allData.push(...traverseNodeProperties(child as SceneNode));
    }
  }
  
  return allData;
}

/**
 * Calculates a comprehensive hash representing the structural hierarchy of a node and all its children.
 * Used to detect structural changes like adding, removing, or rearranging nested elements.
 * 
 * @param node - The scene node to calculate structure hash for
 * @returns Hash string representing the complete structural hierarchy, or empty string if no children
 */
function calculateStructureHash(node: SceneNode): string {
  const hasChildren = 'children' in node && node.children.length > 0;
  if (!hasChildren) return '';
  
  // Get all nested properties recursively
  const allNestedData = traverseNodeProperties(node);
  
  return hashObject(allNestedData);
}

/**
 * Calculates a hash representing the visual content of a node and all its nested children.
 * Focuses on visual properties like fills, strokes, typography that commonly change in design systems.
 * 
 * @param node - The scene node to calculate content hash for
 * @returns Hash string representing the visual content of the entire node hierarchy
 */
function calculateNestedContentHash(node: SceneNode): string {
  const allNestedData = traverseNodeProperties(node);
  
  // Focus on visual properties that commonly change
  const visualData = allNestedData.map(data => ({
    fills: data.fills,
    strokes: data.strokes,
    effects: data.effects,
    fontSize: data.fontSize,
    characters: data.characters,
    fontName: data.fontName,
    cornerRadius: data.cornerRadius,
    strokeWeight: data.strokeWeight,
  }));
  
  return hashObject(visualData);
}

/**
 * Serializes comprehensive properties of a scene node for tracking and comparison.
 * Extracts visual, structural, and behavioral properties into hashes and detailed data formats.
 * 
 * @param sceneNode - The scene node to serialize properties from
 * @returns Promise resolving to partial design system element with serialized properties
 */
async function serializeSceneNodeProperties(sceneNode: SceneNode): Promise<Partial<DesignSystemElement>> {
  const baseProperties: Partial<DesignSystemElement> = {
    fillsHash: 'fills' in sceneNode && sceneNode.fills !== figma.mixed ? serializePaintProperties(sceneNode.fills) : '',
    strokesHash: 'strokes' in sceneNode ? serializeStrokeProperties(sceneNode) : '',
    effectsHash: 'effects' in sceneNode ? serializeEffectProperties(sceneNode.effects) : '',
    layoutHash: serializeLayoutProperties(sceneNode),
    geometryHash: serializeGeometryProperties(sceneNode),
    typographyHash: serializeTypographyProperties(sceneNode),
    structureHash: calculateStructureHash(sceneNode),
    nestedContentHash: calculateNestedContentHash(sceneNode),
    
    // Detailed data for comparison
    fillsData: 'fills' in sceneNode && sceneNode.fills !== figma.mixed ? serializeFillDataDetailed(sceneNode.fills) : 'None',
    strokesData: serializeStrokeDataDetailed(sceneNode),
    cornerRadiusData: serializeCornerRadiusDetailed(sceneNode),
    sizeData: serializeSizeDataDetailed(sceneNode),
    effectsData: 'effects' in sceneNode ? serializeEffectsDataDetailed(sceneNode.effects) : 'None',
    typographyData: serializeTypographyDataDetailed(sceneNode)
  };

  if (sceneNode.type === 'INSTANCE') {
    const instanceData = await serializeInstanceProperties(sceneNode as InstanceNode);
    baseProperties.instanceOverridesHash = instanceData;
  }

  return baseProperties;
}

/**
 * Serializes properties from Figma style objects (paint, text, effect styles) for tracking.
 * Extracts relevant style properties and converts them into trackable hash formats.
 * 
 * @param style - The base style object to serialize (paint, text, or effect style)
 * @returns Partial design system element with style-specific properties
 */
function serializeBaseStyleProperties(style: BaseStyle): Partial<DesignSystemElement> {
  const properties: Partial<DesignSystemElement> = {};
  
  if (style.type === 'PAINT') {
    const paintStyle = style as PaintStyle;
    properties.fillsHash = serializePaintProperties(paintStyle.paints);
  } else if (style.type === 'EFFECT') {
    const effectStyle = style as EffectStyle;
    properties.effectsHash = serializeEffectProperties(effectStyle.effects);
  } else if (style.type === 'TEXT') {
    const textStyle = style as TextStyle;
    const textData = {
      fontSize: textStyle.fontSize,
      fontName: textStyle.fontName,
      textDecoration: textStyle.textDecoration,
      textCase: textStyle.textCase,
      lineHeight: textStyle.lineHeight,
      letterSpacing: textStyle.letterSpacing,
      paragraphIndent: textStyle.paragraphIndent,
      paragraphSpacing: textStyle.paragraphSpacing,
    };
    properties.typographyHash = hashObject(textData);
  }
  
  return properties;
}

// ========================================================================================
// DESIGN SYSTEM ELEMENT COLLECTION
// ========================================================================================
// This section contains functions for collecting and cataloging design system elements
// from Figma documents, including components, styles, and variables.

/**
 * Collects all component nodes from the current Figma document.
 * Loads all pages first to ensure comprehensive component discovery across the entire document.
 * 
 * @returns Promise resolving to array of serialized component elements
 */
// Legacy collection functions - kept for backward compatibility but deprecated
async function _collectComponents(): Promise<DesignSystemElement[]> {
  const components: DesignSystemElement[] = [];
  
  await figma.loadAllPagesAsync();
  const documentComponents = figma.root.findAllWithCriteria({ types: ['COMPONENT'] });
  
  for (const component of documentComponents) {
    const serializedProperties = await serializeSceneNodeProperties(component);
    const element: DesignSystemElement = {
      id: component.id,
      name: component.name,
      type: 'component',
      key: component.key,
      description: component.description,
      parentName: component.parent?.type === 'COMPONENT_SET' ? component.parent.name : undefined,
      ...serializedProperties
    };
    
    components.push(element);
  }
  
  return components;
}

async function _collectComponentSets(): Promise<DesignSystemElement[]> {
  const componentSets: DesignSystemElement[] = [];
  
  await figma.loadAllPagesAsync();
  const documentComponentSets = figma.root.findAllWithCriteria({ types: ['COMPONENT_SET'] });
  
  for (const componentSet of documentComponentSets) {
    const serializedProperties = await serializeSceneNodeProperties(componentSet);
    const element: DesignSystemElement = {
      id: componentSet.id,
      name: componentSet.name,
      type: 'componentSet',
      key: componentSet.key,
      description: componentSet.description,
      ...serializedProperties
    };
    
    componentSets.push(element);
  }
  
  return componentSets;
}

async function _collectStyles(): Promise<DesignSystemElement[]> {
  const styles: DesignSystemElement[] = [];
  
  // Text styles
  const textStyles = await figma.getLocalTextStylesAsync();
  for (const style of textStyles) {
    const element: DesignSystemElement = {
      id: style.id,
      name: style.name,
      type: 'textStyle',
      key: style.key,
      description: style.description,
      ...serializeBaseStyleProperties(style)
    };
    styles.push(element);
  }
  
  // Paint styles
  const paintStyles = await figma.getLocalPaintStylesAsync();
  for (const style of paintStyles) {
    const element: DesignSystemElement = {
      id: style.id,
      name: style.name,
      type: 'colorStyle',
      key: style.key,
      description: style.description,
      ...serializeBaseStyleProperties(style)
    };
    styles.push(element);
  }
  
  // Effect styles
  const effectStyles = await figma.getLocalEffectStylesAsync();
  for (const style of effectStyles) {
    const element: DesignSystemElement = {
      id: style.id,
      name: style.name,
      type: 'colorStyle',
      key: style.key,
      description: style.description,
      ...serializeBaseStyleProperties(style)
    };
    styles.push(element);
  }
  
  return styles;
}

async function _collectVariables(): Promise<DesignSystemElement[]> {
  const variables: DesignSystemElement[] = [];
  
  // Variable collections
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  for (const collection of collections) {
    const element: DesignSystemElement = {
      id: collection.id,
      name: collection.name,
      type: 'variableCollection',
      key: collection.key,
      variableDefinitionHash: hashObject({
        name: collection.name,
        modes: collection.modes,
        defaultModeId: collection.defaultModeId,
        remote: collection.remote,
        hiddenFromPublishing: collection.hiddenFromPublishing,
      })
    };
    variables.push(element);
  }
  
  // Variables
  const localVariables = await figma.variables.getLocalVariablesAsync();
  for (const variable of localVariables) {
    const element: DesignSystemElement = {
      id: variable.id,
      name: variable.name,
      type: 'variable',
      key: variable.key,
      description: variable.description,
      variableDefinitionHash: serializeVariableProperties(variable)
    };
    variables.push(element);
  }
  
  return variables;
}

/**
 * Collects all design system elements from the current Figma document.
 * This is the main aggregation function that gathers components, component sets,
 * styles, and variables into a unified tracking dataset with optimized performance.
 * 
 * @returns Promise resolving to comprehensive array of all design system elements
 */
async function collectDesignSystemElements(): Promise<DesignSystemElement[]> {
  return await PerformanceMonitor.monitor('collectDesignSystemElements', async () => {
    Logger.info('Starting optimized design system element collection', 'collection');
    
    // Use optimized collector with caching
    const elements = await OptimizedCollector.collectOptimized();
    
    Logger.info(`Collected ${elements.length} design system elements (optimized)`, 'collection', {
      cached: !OptimizedCollector.needsFullRescan(),
      totalElements: elements.length
    });
    
    return elements;
  });
}

// ========================================================================================
// CHANGE DETECTION & COMPARISON
// ========================================================================================
// This section provides high-level change detection and comparison logic for identifying
// modifications between design system states.

/**
 * Filters out redundant component set changes when their child components are also modified.
 * Prevents duplicate notifications by removing component set changes if individual components within 
 * the set are already being tracked as changed.
 * 
 * @param changes - The changes object containing added, modified, and removed elements
 * @returns Filtered changes object with redundant component set modifications removed
 */
function filterRedundantComponentSetChanges(changes: Changes): Changes {
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
  const filteredModified = changes.modified.filter(element => {
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

/**
 * Updates component display names to show "Set - Component" format for better clarity.
 * Enhances readability by prefixing component names with their parent component set name.
 * 
 * @param changes - The changes object containing added, modified, and removed elements
 * @returns Changes object with updated component display names in "Set - Component" format
 */
function updateComponentDisplayNames(changes: Changes): Changes {
  const updatedModified = changes.modified.map(element => {
    if (element.type === 'component' && element.parentName) {
      // Update the name to show "Set - Component" format
      return {
        ...element,
        name: `${element.parentName} - ${element.name}`
      };
    }
    return element;
  });
  
  const updatedAdded = changes.added.map(element => {
    if (element.type === 'component' && element.parentName) {
      return {
        ...element,
        name: `${element.parentName} - ${element.name}`
      };
    }
    return element;
  });
  
  const updatedRemoved = changes.removed.map(element => {
    if (element.type === 'component' && element.parentName) {
      return {
        ...element,
        name: `${element.parentName} - ${element.name}`
      };
    }
    return element;
  });
  
  return {
    ...changes,
    modified: updatedModified,
    added: updatedAdded,
    removed: updatedRemoved
  };
}

/**
 * Compares two arrays of design system elements and identifies all changes with detailed analysis.
 * Detects added, removed, and modified elements, providing comprehensive change descriptions.
 * 
 * @param previous - Array of previously tracked design system elements
 * @param current - Array of current design system elements
 * @returns Changes object categorizing all detected modifications with detailed analysis
 */
function compareElements(previous: DesignSystemElement[], current: DesignSystemElement[]): Changes {
  const changes: Changes = { added: [], modified: [], removed: [] };
  
  const previousMap = new Map(previous.map(el => [el.id, el]));
  const currentMap = new Map(current.map(el => [el.id, el]));
  
  // Find added elements
  for (const currentElement of current) {
    if (!previousMap.has(currentElement.id)) {
      changes.added.push(currentElement);
    }
  }
  
  // Find removed elements
  for (const previousElement of previous) {
    if (!currentMap.has(previousElement.id)) {
      changes.removed.push(previousElement);
    }
  }
  
  // Find modified elements with detailed change analysis
  for (const currentElement of current) {
    const previousElement = previousMap.get(currentElement.id);
    if (previousElement && hasElementChanged(previousElement, currentElement)) {
      const detailedChanges = analyzePropertyChanges(previousElement, currentElement);
      const detailedElement: DetailedModifiedElement = {
        ...currentElement,
        changes: detailedChanges,
        changesSummary: createChangesSummary(detailedChanges)
      };
      changes.modified.push(detailedElement);
    }
  }
  
  // Filter redundant component set changes and update display names
  const filteredChanges = filterRedundantComponentSetChanges(changes);
  const finalChanges = updateComponentDisplayNames(filteredChanges);
  
  return finalChanges;
}

/**
 * Determines if a design system element has changed by comparing its hash values
 * and metadata. Uses comprehensive hash comparison across all trackable properties.
 * 
 * @param previous - The previously stored element state
 * @param current - The current element state
 * @returns True if any changes are detected, false otherwise
 */
function hasElementChanged(previous: DesignSystemElement, current: DesignSystemElement): boolean {
  const hashFields = [
    'fillsHash', 'strokesHash', 'effectsHash', 'propertiesHash',
    'componentPropertiesHash', 'structureHash', 'layoutHash',
    'geometryHash', 'appearanceHash', 'borderHash', 'typographyHash',
    'variableUsageHash', 'variableDefinitionHash', 'interactionHash',
    'instanceOverridesHash', 'exposedPropertiesHash', 'variantPropertiesHash',
    'nestedContentHash'
  ];
  
  return hashFields.some(field => previous[field as keyof DesignSystemElement] !== current[field as keyof DesignSystemElement]) ||
         previous.name !== current.name ||
         previous.description !== current.description;
}

// ========================================================================================
// CORE PLUGIN OPERATIONS
// ========================================================================================
// This section contains the main plugin functions for initialization, tracking updates,
// and orchestrating the overall plugin workflow.

/**
 * Initializes the Figma plugin by setting up the UI and starting the tracking system.
 * Automatically begins tracking initialization and handles any initialization errors.
 */
function initializePlugin(): void {
  figma.showUI(__html__, CONFIG.UI.WINDOW_SIZE);
  
  // Automatically start tracking initialization
  initializeTracking().catch(error => {
    console.error('Failed to initialize tracking:', error);
    figma.ui.postMessage({ 
      type: 'error', 
      message: 'Failed to initialize: ' + (error instanceof Error ? error.message : String(error))
    });
  });
}

/**
 * Initializes the design system tracking by collecting current elements and comparing
 * with previously stored data. Sets up initial tracking state or detects existing changes.
 * 
 * Uses centralized error handling for consistent error processing.
 */
async function initializeTracking(): Promise<void> {
  const result = await withErrorHandling(async () => {
          const currentElements = await collectDesignSystemElements();
      return await PerformanceMonitor.monitor('initializeTracking', async () => {
        Logger.info('Starting tracking initialization', 'tracking'); 
      const storedData = getStoredTrackingData();
      
      if (!storedData) {
        // First-time initialization - store current state
        const initialData: TrackingData = {
          timestamp: Date.now(),
          elements: currentElements
        };
        
        // Validate data before storing
        const validationResult = validateTrackingDataDetailed(initialData);
        if (!validationResult.isValid) {
          throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
        }
        
        if (validationResult.warnings.length > 0) {
          Logger.warn(`Initialization warnings: ${validationResult.warnings.join(', ')}`, 'tracking');
        }
        
        setStoredTrackingData(initialData);
        
        figma.ui.postMessage({
          type: 'initialized',
          count: currentElements.length,
          warnings: validationResult.warnings
        });
        
        Logger.info(`Tracking initialized with ${currentElements.length} elements`, 'tracking');
      } else {
        // Compare current state with stored data
        const changes = compareElements(storedData.elements, currentElements);
        const hasChanges = changes.added.length > 0 || changes.modified.length > 0 || changes.removed.length > 0;
        
        if (hasChanges) {
          Logger.info(`Found ${changes.added.length + changes.modified.length + changes.removed.length} changes`, 'tracking');
          figma.ui.postMessage({
            type: 'changes',
            changes: changes,
            timestamp: Date.now(),
            hasChanges: true
          });
        } else {
          Logger.info('No changes detected', 'tracking');
          figma.ui.postMessage({
            type: 'scanComplete'
          });
        }
      }
      
      return currentElements;
    }, currentElements.length);
  }, 'Tracking Initialization');
  
  // If initialization failed, the error was already handled by withErrorHandling
  if (result === undefined) {
    Logger.error('Tracking initialization failed', 'tracking');
    return;
  }
}

/**
 * Updates the stored tracking data with the current state of design system elements.
 * Creates a new snapshot of all tracked elements and stores it persistently.
 * 
 * @param notifyUI - Whether to send notification message to UI after update
 * Uses centralized error handling for consistent error processing.
 */
async function updateTrackingData(notifyUI: boolean = true): Promise<void> {
  await withErrorHandling(async () => {
    const currentElements = await collectDesignSystemElements();
    const trackingData: TrackingData = {
      timestamp: Date.now(),
      elements: currentElements
    };
    
    setStoredTrackingData(trackingData);
    
    if (notifyUI) {
      figma.ui.postMessage({
        type: 'updated',
        elementsCount: currentElements.length,
        timestamp: trackingData.timestamp
      });
    }
  }, 'Tracking Data Update');
}

/**
 * Scans the current design system state and compares it with stored tracking data
 * to detect any changes. Initiates tracking if no stored data exists.
 * 
 * Uses centralized error handling for consistent error processing.
 */
async function scanAndCompare(): Promise<void> {
  await withErrorHandling(async () => {
    const currentElements = await collectDesignSystemElements();
    const storedData = getStoredTrackingData();
    
    if (!storedData) {
      await initializeTracking();
      return;
    }
    
    const changes = compareElements(storedData.elements, currentElements);
    const hasChanges = changes.added.length > 0 || changes.modified.length > 0 || changes.removed.length > 0;
    
    if (hasChanges) {
      figma.ui.postMessage({
        type: 'changes',
        changes: changes,
        timestamp: Date.now(),
        hasChanges: true
      });
    } else {
      figma.ui.postMessage({
        type: 'scanComplete'
      });
    }
  }, 'Change Scanning');
}

/**
 * Formats a design system element for display with detailed change information.
 * Creates human-readable text with emojis, names, and change descriptions for UI presentation.
 * 
 * @param element - The design system element or modified element to format
 * @returns Formatted string with element details and change descriptions
 */
function formatElementForDisplay(element: DesignSystemElement | DetailedModifiedElement): string {
  const typeEmojis = {
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
  if ('changes' in element && element.changes && element.changes.length > 0) {
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

// ========================================================================================
// FIGMA INTEGRATION & VISUALIZATION
// ========================================================================================
// This section contains functions for creating visual changelog entries and integrating
// change information directly into Figma documents.

/**
 * Creates a visual changelog entry in Figma by adding changes to a dedicated Logify page.
 * Generates formatted frames with sections for added, modified, and removed elements,
 * including detailed change descriptions and optional user comments.
 * 
 * @param changes - The changes object containing all detected modifications
 * @throws Error if fonts cannot be loaded or Figma operations fail
 */
async function addToFigma(changes: Changes): Promise<void> {
  await withErrorHandling(async () => {
    // Load required fonts
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    await figma.loadFontAsync({ family: "Inter", style: "Medium" });
    await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });
    
    // Ensure pages are loaded before accessing children
    await figma.loadAllPagesAsync();
    
    // Find or create the Logify page
    let changelogPage = figma.root.children.find(page => page.name === LOGIFY_PAGE_NAME);
    
    if (!changelogPage) {
      changelogPage = figma.createPage();
      changelogPage.name = LOGIFY_PAGE_NAME;
    }
    
    // Find or create the main container
    let mainContainer = changelogPage.children.find(node => 
      node.type === 'FRAME' && node.name === CHANGELOG_CONTAINER_NAME
    ) as FrameNode;
    
    if (!mainContainer) {
      mainContainer = figma.createFrame();
      mainContainer.name = CHANGELOG_CONTAINER_NAME;
      mainContainer.layoutMode = "VERTICAL";
      mainContainer.primaryAxisSizingMode = "AUTO";
      mainContainer.counterAxisSizingMode = "AUTO";
      mainContainer.itemSpacing = 16;
      mainContainer.paddingTop = 16;
      mainContainer.paddingBottom = 16;
      mainContainer.paddingLeft = 16;
      mainContainer.paddingRight = 16;
      mainContainer.fills = [{ type: "SOLID", color: { r: 0.98, g: 0.98, b: 0.98 } }];
      
      changelogPage.appendChild(mainContainer);
    }
    
    // Create entry frame
    const entryFrame = figma.createFrame();
    entryFrame.name = `${ENTRY_NAME_PREFIX} ${new Date().toLocaleString()}`;
    entryFrame.layoutMode = "VERTICAL";
    entryFrame.primaryAxisSizingMode = "AUTO";
    entryFrame.counterAxisSizingMode = "AUTO";
    entryFrame.layoutAlign = "STRETCH";
    entryFrame.itemSpacing = 12;
    entryFrame.paddingTop = 16;
    entryFrame.paddingBottom = 16;
    entryFrame.paddingLeft = 16;
    entryFrame.paddingRight = 16;
    entryFrame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    entryFrame.cornerRadius = 8;
    
    // Add timestamp
    const timestampText = figma.createText();
    timestampText.characters = new Date().toLocaleString();
    timestampText.fontSize = 14;
    timestampText.fontName = { family: "Inter", style: "Medium" };
    timestampText.fills = [{ type: "SOLID", color: { r: 0.4, g: 0.4, b: 0.4 } }];
    entryFrame.appendChild(timestampText);
    
    
    // Helper function to create sections with enhanced formatting
    const createSection = (title: string, items: (DesignSystemElement | DetailedModifiedElement)[], icon: string) => {
      if (items.length === 0) return null;
      
      const sectionFrame = figma.createFrame();
      sectionFrame.name = title;
      sectionFrame.layoutMode = "VERTICAL";
      sectionFrame.primaryAxisSizingMode = "AUTO";
      sectionFrame.counterAxisSizingMode = "AUTO";
      sectionFrame.layoutAlign = "STRETCH";
      sectionFrame.itemSpacing = 8;
      sectionFrame.fills = [];
      
      // Section title
      const titleText = figma.createText();
      titleText.characters = `${icon} ${title}`;
      titleText.fontSize = 16;
      titleText.fontName = { family: "Inter", style: "Semi Bold" };
      titleText.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
      sectionFrame.appendChild(titleText);
      
      // Items with enhanced display
      for (const item of items) {
        const itemText = figma.createText();
        
        itemText.characters = formatElementForDisplay(item);
        itemText.fontSize = 12;
        itemText.lineHeight = { unit: "PERCENT", value: 160 };
        itemText.fontName = { family: "Inter", style: "Regular" };
        itemText.fills = [{ type: "SOLID", color: { r: 0.3, g: 0.3, b: 0.4 } }];
        
        // Special styling for modified items with changes
        if ('changes' in item && item.changes && item.changes.length > 0) {
          itemText.fills = [{ type: "SOLID", color: { r: 0.2, g: 0.4, b: 0.8 } }];
          
          // Create a container for better layout
          const itemContainer = figma.createFrame();
          itemContainer.layoutMode = "VERTICAL";
          itemContainer.primaryAxisSizingMode = "AUTO";
          itemContainer.counterAxisSizingMode = "AUTO";
          itemContainer.layoutAlign = "STRETCH";
          itemContainer.itemSpacing = 4;
          itemContainer.fills = [];
          itemContainer.paddingLeft = 8;
          itemContainer.paddingRight = 8;
          itemContainer.paddingTop = 6;
          itemContainer.paddingBottom = 6;
          itemContainer.cornerRadius = 4;
          itemContainer.fills = [{ type: "SOLID", color: { r: 0.95, g: 0.97, b: 1 } }];
          
          itemContainer.appendChild(itemText);
          sectionFrame.appendChild(itemContainer);
        } else {
          sectionFrame.appendChild(itemText);
        }
      }
      
      return sectionFrame;
    };
    
    // Add sections
    const addedSection = createSection("Added", changes.added, "✨");
    const modifiedSection = createSection("Modified", changes.modified, "✏️");
    const removedSection = createSection("Removed", changes.removed, "🗑️");
    
    [addedSection, modifiedSection, removedSection].forEach(section => {
      if (section) entryFrame.appendChild(section);
    });

    // Add comment if provided
    if (changes.comment) {
      const commentText = figma.createText();
      const wrappedComment = wrapText(changes.comment, CONFIG.LIMITS.TEXT_WRAP_LENGTH);
      commentText.characters = `💬 ${wrappedComment}`;
      commentText.fontSize = 14;
      commentText.lineHeight = { unit: "PERCENT", value: 160 };
      commentText.fontName = { family: "Inter", style: "Regular" };
      commentText.fills = [{ type: "SOLID", color: { r: 0.2, g: 0.2, b: 0.2 } }];
      
      // Create comment container for better styling
      const commentContainer = figma.createFrame();
      commentContainer.layoutMode = "VERTICAL";
      commentContainer.primaryAxisSizingMode = "AUTO";
      commentContainer.counterAxisSizingMode = "AUTO";
      commentContainer.layoutAlign = "STRETCH";
      commentContainer.paddingTop = 8;
      commentContainer.paddingBottom = 8;
      commentContainer.paddingLeft = 12;
      commentContainer.paddingRight = 12;
      commentContainer.cornerRadius = 4;
      commentContainer.fills = [{ type: "SOLID", color: { r: 0.97, g: 0.99, b: 1 } }];
      
      commentContainer.appendChild(commentText);
      entryFrame.appendChild(commentContainer);
    }
    
    // Add to container
    if (mainContainer.children.length > 0) {
      mainContainer.insertChild(0, entryFrame);
    } else {
      mainContainer.appendChild(entryFrame);
    }
    
    // Switch to the logify page
    await figma.setCurrentPageAsync(changelogPage);
    
    // Update tracking data
    await updateTrackingData(false);
    
    // Notify UI
    figma.ui.postMessage({ type: 'addedToFigma' });
    figma.notify('Logify entry added to 🖹Logify page');
    
  }, 'Add to Figma');
}

/**
 * Wraps long text by breaking it into lines that don't exceed the specified length.
 * Preserves word boundaries and avoids breaking words in the middle.
 * 
 * @param text - The text to wrap
 * @param maxLength - Maximum characters per line
 * @returns Wrapped text with line breaks
 */
function wrapText(text: string, maxLength: number): string {
  const words = text.split(' ');
  let result = '';
  let line = '';

  for (const word of words) {
    if ((line + word).length > maxLength) {
      result += line.trimEnd() + '\n';
      line = '';
    }
    line += word + ' ';
  }

  result += line.trimEnd();
  return result;
}

// ========================================================================================
// MESSAGE HANDLING & UI COMMUNICATION
// ========================================================================================
// This section handles all communication between the plugin and UI, processing messages
// and coordinating actions based on user interactions.

// Create debounced versions of main operations
const debouncedScanAndCompare = Debouncer.debounce('scanAndCompare', scanAndCompare, 200);
const debouncedInitializeTracking = Debouncer.debounce('initializeTracking', initializeTracking, 100);

/**
 * Handles messages from the plugin UI and dispatches them to appropriate handlers.
 * Provides comprehensive error handling and user feedback for all operations.
 * Uses debouncing to prevent excessive operations and improve performance.
 * 
 * Supported message types:
 * - initialize: Set up initial tracking
 * - refresh: Scan for changes
 * - addToFigma: Create changelog entry in Figma
 * - skipVersion: Skip current version tracking
 * - viewRecords: Retrieve stored tracking data
 */
figma.ui.onmessage = async (msg: unknown) => {
  await withErrorHandling(async () => {
    if (!isValidPluginMessage(msg)) {
      figma.ui.postMessage({
        type: 'error',
        message: 'Invalid message format'
      });
      return;
    }
    
    switch (msg.type) {
      case 'initialize':
        debouncedInitializeTracking();
        break;
        
      case 'refresh':
        debouncedScanAndCompare();
        break;
        
      case 'addToFigma': {
        const addMessage = msg as { type: 'addToFigma'; changes?: unknown; comment?: unknown };
        if (addMessage.changes && validateChanges(addMessage.changes)) {
          // Validate comment if provided
          const comment = typeof addMessage.comment === 'string' ? addMessage.comment.trim() : '';
          if (comment && comment.length > CONFIG.LIMITS.COMMENT_MAX_LENGTH) {
            figma.ui.postMessage({
              type: 'error',
              message: `Comment too long (maximum ${CONFIG.LIMITS.COMMENT_MAX_LENGTH} characters)`
            });
            break;
          }
          
          // Add comment to changes object
          const changesWithComment = {
            ...addMessage.changes,
            comment: comment || undefined
          };
          
          await addToFigma(changesWithComment);
        } else {
          figma.ui.postMessage({
            type: 'error',
            message: 'Invalid changes data'
          });
        }
        break;
      }
        
      case 'skipVersion':
        await updateTrackingData(false);
        figma.ui.postMessage({ type: 'versionSkipped' });
        figma.notify('Version skipped - changes will not be logged');
        break;
        
      case 'viewRecords': {
        const storedData = getStoredTrackingData();
        if (storedData) {
          figma.ui.postMessage({
            type: 'records',
            elements: storedData.elements,
            timestamp: storedData.timestamp
          });
        } else {
          figma.ui.postMessage({
            type: 'error',
            message: 'No records found'
          });
        }
        break;
      }

      case 'getPerformanceMetrics': {
        const metrics = PerformanceMonitor.getMetrics();
        const stats = {
          totalOperations: metrics.length,
          avgDuration: metrics.length > 0 ? 
            metrics.filter(m => m.duration).reduce((sum, m) => sum + (m.duration || 0), 0) / metrics.filter(m => m.duration).length : 0,
          slowOperations: metrics.filter(m => m.duration && m.duration > CONFIG.PERFORMANCE.SLOW_OPERATION_THRESHOLD).length,
          elementsProcessed: metrics.reduce((sum, m) => sum + (m.elementsProcessed || 0), 0)
        };
        
        figma.ui.postMessage({
          type: 'performanceMetrics',
          metrics: stats,
          detailed: metrics
        });
        break;
      }

      case 'clearPerformanceMetrics': {
        PerformanceMonitor.clearMetrics();
        figma.ui.postMessage({
          type: 'metricsCleared'
        });
        figma.notify('Performance metrics cleared');
        break;
      }

      case 'exportLogs': {
        const logs = Logger.exportLogs();
        figma.ui.postMessage({
          type: 'logsExported',
          logs: logs
        });
        break;
      }

      case 'clearLogs': {
        Logger.clearLogs();
        figma.ui.postMessage({
          type: 'logsCleared'
        });
        figma.notify('Logs cleared');
        break;
      }

      case 'setLogLevel': {
        const setLevelMessage = msg as { type: 'setLogLevel'; level: number };
        if (typeof setLevelMessage.level === 'number' && 
            setLevelMessage.level >= 0 && setLevelMessage.level <= 3) {
          Logger.setLogLevel(setLevelMessage.level);
          figma.ui.postMessage({
            type: 'logLevelSet',
            level: setLevelMessage.level
          });
          figma.notify(`Log level set to ${['DEBUG', 'INFO', 'WARN', 'ERROR'][setLevelMessage.level]}`);
        } else {
          figma.ui.postMessage({
            type: 'error',
            message: 'Invalid log level'
          });
        }
        break;
      }
        
      default: {
        const unknownMessage = msg as { type: string };
        console.warn('Unknown message type:', unknownMessage.type);
        figma.ui.postMessage({
          type: 'error',
          message: 'Unknown command: ' + unknownMessage.type
        });
        break;
      }
    }
  }, 'Message Handler');
};

// ========================================================================================
// PLUGIN INITIALIZATION
// ========================================================================================
// This section contains the final plugin initialization code that starts the entire
// plugin lifecycle when loaded by Figma.

initializePlugin();

