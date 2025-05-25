/// <reference types="@figma/plugin-typings" />

// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

// This plugin tracks changes to design system elements (components, styles, variables)

// Define types for our plugin
interface DesignSystemElement {
  id: string;
  name: string;
  type: string; // e.g., 'component', 'componentSet', 'textStyle', 'colorStyle', 'variable'
  key?: string;
  description?: string;
  variantProperties?: { [property: string]: string } | null; // For display in Figma entry
  variantPropertiesHash?: string; // Hash of variantProperties for comparison
  parentName?: string; // For components that are part of a ComponentSet
  modifiedAt?: number;
  updatedAt?: number;

  // Hashes for visual and structural properties
  fillsHash?: string;
  strokesHash?: string;
  effectsHash?: string;
  
  // Hash of defining properties for TextNodes, BaseStyles, or InstanceNodes (mainComponentId + overrides)
  propertiesHash?: string; 
  
  // Hash of component property definitions for ComponentNode or ComponentSetNode
  componentPropertiesHash?: string; // For ComponentNode/Set definitions OR InstanceNode property overrides hash
  
  childrenIds?: string[]; // Direct children IDs, if applicable for Frame-like nodes (Component, ComponentSet, Frame, Group, Instance)
  structureHash?: string; // Hash of the node's own significant structure + children structure hashes, if it has children
}

interface TrackingData {
  timestamp: number;
  elements: DesignSystemElement[];
}

interface Changes {
  added: DesignSystemElement[];
  modified: DesignSystemElement[];
  removed: DesignSystemElement[];
}

interface PluginMessage {
  type: string;
  [key: string]: any;
}

// Plugin namespace for shared data storage
const PLUGIN_NAMESPACE = 'changelog_tracker';
const TRACKING_DATA_KEY = 'trackingData';
const CHUNK_SIZE_LIMIT = 90000; // 90KB to stay safely under 100KB limit

// Performance constants
const BATCH_SIZE = 50;
const YIELD_INTERVAL = 0;

// UI constants
const LOGIFY_PAGE_NAME = "🖹Logify";
const CHANGELOG_CONTAINER_NAME = "Changelog Container";
const ENTRY_NAME_PREFIX = "Logify Entry";

// Simple hash function (using a common algorithm like djb2)
function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) + hash) + char; /* hash * 33 + char */
  }
  return hash.toString(16); // Return as hex string
}

// Validation functions for data integrity
function validateDesignSystemElement(element: any): element is DesignSystemElement {
  return element &&
         typeof element.id === 'string' &&
         typeof element.name === 'string' &&
         typeof element.type === 'string' &&
         (element.key === undefined || typeof element.key === 'string') &&
         (element.description === undefined || typeof element.description === 'string') &&
         (element.variantPropertiesHash === null || element.variantPropertiesHash === undefined || typeof element.variantPropertiesHash === 'string') &&
         (element.parentName === undefined || typeof element.parentName === 'string') &&
         (element.modifiedAt === undefined || typeof element.modifiedAt === 'number') &&
         (element.updatedAt === undefined || typeof element.updatedAt === 'number');
}

function validateTrackingData(data: any): data is TrackingData {
  return data &&
         typeof data.timestamp === 'number' &&
         Array.isArray(data.elements) &&
         data.elements.every(validateDesignSystemElement);
}

function validateChanges(changes: any): changes is Changes {
  return changes &&
         Array.isArray(changes.added) &&
         Array.isArray(changes.modified) &&
         Array.isArray(changes.removed) &&
         changes.added.every(validateDesignSystemElement) &&
         changes.modified.every(validateDesignSystemElement) &&
         changes.removed.every(validateDesignSystemElement);
}

// Helper function to compress data for storage (shorter property names)
function compressDataForStorage(data: TrackingData): any {
  return {
    t: data.timestamp, // timestamp -> t
    e: data.elements.map(element => ({
      i: element.id, // id -> i
      n: element.name, // name -> n
      ty: element.type, // type -> ty
      k: element.key, // key -> k
      d: element.description, // description -> d
      vp: element.variantProperties, // variantProperties -> vp
      vh: element.variantPropertiesHash, // variantPropertiesHash -> vh
      pn: element.parentName, // parentName -> pn
      ma: element.modifiedAt, // modifiedAt -> ma
      ua: element.updatedAt, // updatedAt -> ua
      fh: element.fillsHash, // fillsHash -> fh
      sh: element.strokesHash, // strokesHash -> sh
      eh: element.effectsHash, // effectsHash -> eh
      ph: element.propertiesHash, // propertiesHash -> ph
      ch: element.componentPropertiesHash, // componentPropertiesHash -> ch
      ci: element.childrenIds, // childrenIds -> ci
      st: element.structureHash // structureHash -> st
    }))
  };
}

// Helper function to decompress data from storage
function decompressDataFromStorage(compressedData: any): TrackingData {
  return {
    timestamp: compressedData.t,
    elements: compressedData.e.map((element: any) => ({
      id: element.i,
      name: element.n,
      type: element.ty,
      key: element.k,
      description: element.d,
      variantProperties: element.vp,
      variantPropertiesHash: element.vh,
      parentName: element.pn,
      modifiedAt: element.ma,
      updatedAt: element.ua,
      fillsHash: element.fh,
      strokesHash: element.sh,
      effectsHash: element.eh,
      propertiesHash: element.ph,
      componentPropertiesHash: element.ch,
      childrenIds: element.ci,
      structureHash: element.st
    }))
  };
}

// Helper functions for chunked shared data storage (maintains sync between users)
function getStoredTrackingData(): TrackingData | null {
  try {
    // First, get the metadata to know how many chunks exist
    const metadataStr = figma.root.getSharedPluginData(PLUGIN_NAMESPACE, TRACKING_DATA_KEY + '_meta');
    
    if (!metadataStr || metadataStr.trim() === '') {
      console.log('getStoredTrackingData: No metadata found.');
      return null;
    }
    
    const metadata = JSON.parse(metadataStr);
    console.log('getStoredTrackingData: Found metadata with', metadata.chunkCount, 'chunks');
    
    // Reconstruct the data from chunks
    let reconstructedDataStr = '';
    for (let i = 0; i < metadata.chunkCount; i++) {
      const chunkKey = TRACKING_DATA_KEY + '_chunk_' + i;
      const chunkData = figma.root.getSharedPluginData(PLUGIN_NAMESPACE, chunkKey);
      if (!chunkData) {
        console.error('getStoredTrackingData: Missing chunk', i);
        return null;
      }
      reconstructedDataStr += chunkData;
    }
    
    console.log('getStoredTrackingData: Reconstructed data length:', reconstructedDataStr.length);
    
    const compressedData = JSON.parse(reconstructedDataStr);
    const data = decompressDataFromStorage(compressedData);
    console.log('getStoredTrackingData: Parsed data timestamp:', data.timestamp);
    console.log('getStoredTrackingData: Parsed elements count:', data.elements.length);
    
    // Validate data integrity
    if (!validateTrackingData(data)) {
      console.warn('getStoredTrackingData: Invalid tracking data format detected, attempting to reset...');
      clearStoredTrackingData();
      console.log('getStoredTrackingData: Invalid data cleared.');
      return null;
    }
    
    return data as TrackingData;
  } catch (error) {
    console.error('getStoredTrackingData: Error retrieving stored data:', error);
    clearStoredTrackingData();
    console.log('getStoredTrackingData: Corrupted data cleared.');
    return null;
  }
}

function setStoredTrackingData(data: TrackingData): void {
  try {
    const compressedData = compressDataForStorage(data);
    const dataStr = JSON.stringify(compressedData);
    console.log('setStoredTrackingData: Compressed data length:', dataStr.length);
    console.log('setStoredTrackingData: Original vs compressed ratio:', (dataStr.length / JSON.stringify(data).length * 100).toFixed(1) + '%');
    
    // Clear any existing chunks first
    clearStoredTrackingData();
    
    // Split data into chunks
    const chunks: string[] = [];
    for (let i = 0; i < dataStr.length; i += CHUNK_SIZE_LIMIT) {
      chunks.push(dataStr.substring(i, i + CHUNK_SIZE_LIMIT));
    }
    
    console.log('setStoredTrackingData: Split into', chunks.length, 'chunks');
    
    // Store each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunkKey = TRACKING_DATA_KEY + '_chunk_' + i;
      figma.root.setSharedPluginData(PLUGIN_NAMESPACE, chunkKey, chunks[i]);
      console.log('setStoredTrackingData: Stored chunk', i, 'with length:', chunks[i].length);
    }
    
    // Store metadata about chunks
    const metadata = {
      chunkCount: chunks.length,
      timestamp: data.timestamp,
      totalLength: dataStr.length
    };
    figma.root.setSharedPluginData(PLUGIN_NAMESPACE, TRACKING_DATA_KEY + '_meta', JSON.stringify(metadata));
    
    console.log('setStoredTrackingData: Success. Data saved in', chunks.length, 'chunks');
  } catch (error) {
    console.error('setStoredTrackingData: CRITICAL ERROR during chunked storage:', error);
    figma.notify('Critical error: Failed to save tracking data.', { error: true });
  }
}

function clearStoredTrackingData(): void {
  try {
    // Get existing metadata to know how many chunks to clear
    const metadataStr = figma.root.getSharedPluginData(PLUGIN_NAMESPACE, TRACKING_DATA_KEY + '_meta');
    
    if (metadataStr && metadataStr.trim() !== '') {
      const metadata = JSON.parse(metadataStr);
      
      // Clear all chunks
      for (let i = 0; i < metadata.chunkCount; i++) {
        const chunkKey = TRACKING_DATA_KEY + '_chunk_' + i;
        figma.root.setSharedPluginData(PLUGIN_NAMESPACE, chunkKey, '');
      }
    }
    
    // Clear metadata
    figma.root.setSharedPluginData(PLUGIN_NAMESPACE, TRACKING_DATA_KEY + '_meta', '');
    
    // Also clear any potential old single-entry data
    figma.root.setSharedPluginData(PLUGIN_NAMESPACE, TRACKING_DATA_KEY, '');
    
    console.log('clearStoredTrackingData: All chunks and metadata cleared');
  } catch (error) {
    console.error('clearStoredTrackingData: Error clearing data:', error);
  }
}

// Main entry point
figma.showUI(__html__, { width: 400, height: 500 });

// Initialize plugin
function initializePlugin(): void {
  try {
    // Check if we have existing tracking data
    const storedData = getStoredTrackingData();
    
    if (!storedData) {
      // First time use - show initialization screen
      figma.ui.postMessage({ type: 'init' });
    } else {
      // Compare current elements with stored elements
      scanAndCompare();
    }
  } catch (error) {
    console.error('Error initializing plugin:', error);
    figma.ui.postMessage({ 
      type: 'error',
      message: 'Failed to initialize: ' + (error instanceof Error ? error.message : String(error))
    });
  }
}

// Helper function to serialize node structure (now returns a hash)
function calculateStructureHash(node: SceneNode): string {
  try {
    // Basic node info for structure definition
    const nodeInfo: any = {
      id: node.id, // Keep id for reference if needed, but it won't affect hash of children structure itself
      name: node.name,
      type: node.type,
      // Potentially other structurally significant properties that are not visual
      // e.g., layoutMode, primaryAxisSizingMode, counterAxisSizingMode for auto-layout frames
    };
    if ('children' in node && (node as FrameNode | ComponentNode | ComponentSetNode | InstanceNode).children.length > 0) {
      nodeInfo.children = (node as FrameNode | ComponentNode | ComponentSetNode | InstanceNode).children.map(child => calculateStructureHash(child));
    }
    return simpleHash(JSON.stringify(nodeInfo));
  } catch (error) {
    console.error('Error calculating node structure hash for node ' + node.id + ':', error);
    return 'error_hash'; // Return a consistent error hash
  }
}

// NEW: Helper for BaseStyles
function serializeBaseStyleProperties(style: BaseStyle): {
  propertiesHash?: string;
  fillsHash?: string;      // For PaintStyle, can represent its paints
  effectsHash?: string;    // For EffectStyle, can represent its effects
} {
  const result: any = {};
  try {
    let definingProperties: any = { baseType: style.type, name: style.name, key: style.key, description: style.description };
    if (style.type === 'TEXT') {
      const ts = style as TextStyle;
      definingProperties = { ...definingProperties, fontName: ts.fontName, fontSize: ts.fontSize, letterSpacing: ts.letterSpacing, lineHeight: ts.lineHeight, paragraphIndent: ts.paragraphIndent, paragraphSpacing: ts.paragraphSpacing, textCase: ts.textCase, textDecoration: ts.textDecoration };
    } else if (style.type === 'PAINT') {
      const ps = style as PaintStyle;
      definingProperties.paints = ps.paints;
      if (ps.paints && ps.paints.length > 0) {
        result.fillsHash = simpleHash(JSON.stringify(ps.paints)); 
      }
    } else if (style.type === 'EFFECT') {
      const es = style as EffectStyle;
      definingProperties.effects = es.effects;
      if (es.effects && es.effects.length > 0) {
         result.effectsHash = simpleHash(JSON.stringify(es.effects));
      }
    } else if (style.type === 'GRID') {
      const gs = style as GridStyle;
      definingProperties.layoutGrids = gs.layoutGrids;
    }
    result.propertiesHash = simpleHash(JSON.stringify(definingProperties));
    return result;
  } catch (error) {
    console.error(`Error in serializeBaseStyleProperties for style ${style.id} (${style.type}):`, error);
    return {};
  }
}

// MODIFIED: Renamed and adapted for SceneNodes only
function serializeSceneNodePropertiesAndStructure(sceneNode: SceneNode): {
  fillsHash?: string;
  strokesHash?: string;
  effectsHash?: string;
  propertiesHash?: string; // For TextNode specific attributes, or InstanceNode mainComponent+props
  componentPropertiesHash?: string; // For ComponentNode/ComponentSetNode definitions
  childrenIds?: string[];
  structureHash?: string;
} {
  const result: any = {};
  try {
    if ('fills' in sceneNode && sceneNode.fills && (sceneNode.fills as readonly Paint[]).length > 0) {
      result.fillsHash = simpleHash(JSON.stringify(sceneNode.fills));
    }
    if ('strokes' in sceneNode && sceneNode.strokes && (sceneNode.strokes as readonly Paint[]).length > 0) {
      result.strokesHash = simpleHash(JSON.stringify(sceneNode.strokes));
    }
    if ('effects' in sceneNode && sceneNode.effects && (sceneNode.effects as readonly Effect[]).length > 0) {
      result.effectsHash = simpleHash(JSON.stringify(sceneNode.effects));
    }

    if (sceneNode.type === 'COMPONENT_SET') {
      const compSet = sceneNode as ComponentSetNode;
      if (compSet.componentPropertyDefinitions && Object.keys(compSet.componentPropertyDefinitions).length > 0) {
        result.componentPropertiesHash = simpleHash(JSON.stringify(compSet.componentPropertyDefinitions));
      }
      if (compSet.children.length > 0) {
        result.childrenIds = compSet.children.map(child => child.id);
        result.structureHash = calculateStructureHash(compSet);
      }
    } else if (sceneNode.type === 'COMPONENT') {
      const compNode = sceneNode as ComponentNode;
      // Only access componentPropertyDefinitions if it's a non-variant component.
      // Variants rely on the parent set's definitions and their own variantProperties.
      if (compNode.parent?.type !== 'COMPONENT_SET') { 
        // This is a base component or a component not part of a set.
        // The error states "Can only get definitions of a component set or non-variant component".
        // A non-variant component is one whose parent is not a ComponentSetNode.
        try {
            if (compNode.componentPropertyDefinitions && Object.keys(compNode.componentPropertyDefinitions).length > 0) {
                result.componentPropertiesHash = simpleHash(JSON.stringify(compNode.componentPropertyDefinitions));
            }
        } catch (e) {
            // This catch might be redundant if the condition above is perfect, but good for safety.
            console.warn(`Could not access componentPropertyDefinitions for COMPONENT node ${compNode.id} (parent type: ${compNode.parent?.type}). Error: ${e}`);
        }
      }
      // For all components (base or variant), capture children if they exist
      if (compNode.children.length > 0) {
        result.childrenIds = compNode.children.map(child => child.id);
        result.structureHash = calculateStructureHash(compNode);
      }
    } else if (sceneNode.type === 'TEXT') {
      const textNode = sceneNode as TextNode;
      const textProps = { fontName: textNode.fontName, fontSize: textNode.fontSize, letterSpacing: textNode.letterSpacing, lineHeight: textNode.lineHeight, paragraphIndent: textNode.paragraphIndent, paragraphSpacing: textNode.paragraphSpacing, textAlignHorizontal: textNode.textAlignHorizontal, textAlignVertical: textNode.textAlignVertical, textCase: textNode.textCase, textDecoration: textNode.textDecoration }; // removed appliedTypeRamp for now as it might be too complex or large
      result.propertiesHash = simpleHash(JSON.stringify(textProps));
    } else if (sceneNode.type === 'INSTANCE') {
      const instanceNode = sceneNode as InstanceNode;
      const instanceDetailsForPropertiesHash = { mainComponentId: instanceNode.mainComponent?.id }; // Base for propertiesHash
      result.propertiesHash = simpleHash(JSON.stringify(instanceDetailsForPropertiesHash));
      
      // Hash the overridden componentProperties if they exist
      if (instanceNode.componentProperties && Object.keys(instanceNode.componentProperties).length > 0) {
          result.componentPropertiesHash = simpleHash(JSON.stringify(instanceNode.componentProperties));
      }
      
      if (instanceNode.children?.length > 0){
          result.childrenIds = instanceNode.children.map(child => child.id);
          result.structureHash = calculateStructureHash(instanceNode); 
      }
    } else if ((sceneNode.type === 'FRAME' || sceneNode.type === 'GROUP') && sceneNode.children.length > 0) {
      const frameOrGroup = sceneNode as FrameNode | GroupNode;
      result.childrenIds = frameOrGroup.children.map(child => child.id);
      result.structureHash = calculateStructureHash(frameOrGroup);
    }
    return result;
  } catch (error) {
    console.error(`Error in serializeSceneNodePropertiesAndStructure for node ${sceneNode.id} (${sceneNode.type}):`, error);
    return {};
  }
}

// MODIFIED: collectDesignSystemElements to use new serialization functions
async function collectDesignSystemElements(): Promise<DesignSystemElement[]> {
  const elements: DesignSystemElement[] = [];
  try {
    figma.ui.postMessage({ type: 'progress', message: 'Initializing scan...', progress: 0 });
    const totalPages = figma.root.children.length;
    let processedPages = 0;

    for (const page of figma.root.children) {
      if (page.getSharedPluginData('figma', 'private') === 'true') {
        processedPages++;
        continue;
      }
      const progress = Math.round((processedPages / totalPages) * 80);
      figma.ui.postMessage({ type: 'progress', message: `Scanning page: ${page.name}...`, progress });
      await page.loadAsync();

      const componentsOnPage = page.findAllWithCriteria({ types: ['COMPONENT'] });
      const componentSetsOnPage = page.findAllWithCriteria({ types: ['COMPONENT_SET'] });

      for (const node of componentsOnPage) { // Explicitly iterate ComponentNode[]
        const visualProps = serializeSceneNodePropertiesAndStructure(node);
        const variantProps = ('variantProperties' in node && node.variantProperties) ? node.variantProperties : null;
        elements.push({
          id: node.id,
          name: node.name,
          type: 'component', // Correct type for ComponentNode
          key: node.key,
          description: node.description,
          variantProperties: variantProps,
          variantPropertiesHash: variantProps ? simpleHash(JSON.stringify(variantProps)) : undefined,
          parentName: node.parent?.type === 'COMPONENT_SET' ? node.parent.name : undefined,
          modifiedAt: Date.now(), 
          updatedAt: Date.now(),  
          ...visualProps
        });
      }

      for (const node of componentSetsOnPage) { // Explicitly iterate ComponentSetNode[]
        const visualProps = serializeSceneNodePropertiesAndStructure(node);
        elements.push({
          id: node.id,
          name: node.name,
          type: 'componentSet', // Correct type for ComponentSetNode
          key: node.key,
          description: node.description,
          variantProperties: null, // ComponentSet itself doesn't have variantProperties in the same way a variant does
          parentName: undefined, // ComponentSet typically doesn't have a relevant parentName in this context
          modifiedAt: Date.now(),
          updatedAt: Date.now(),
          ...visualProps
        });
      }
      processedPages++;
    }

    figma.ui.postMessage({ type: 'progress', message: 'Processing styles...', progress: 80 });
    const localStyles: BaseStyle[] = [
      ...(await figma.getLocalTextStylesAsync()),
      ...(await figma.getLocalPaintStylesAsync()),
      ...(await figma.getLocalEffectStylesAsync()),
      ...(await figma.getLocalGridStylesAsync()),
    ];

    for (const style of localStyles) {
      const styleProps = serializeBaseStyleProperties(style);
      let elementType = 'unknownStyle';
      if (style.type === 'TEXT') elementType = 'textStyle';
      else if (style.type === 'PAINT') elementType = 'paintStyle';
      else if (style.type === 'EFFECT') elementType = 'effectStyle';
      else if (style.type === 'GRID') elementType = 'gridStyle';
      
      elements.push({
        id: style.id,
        name: style.name,
        type: elementType, 
        key: style.key,
        description: style.description,
        variantProperties: null, // Styles don't have variant properties
        variantPropertiesHash: undefined, // Should be undefined, not null
        parentName: undefined, // Styles don't have parent names in this context
        modifiedAt: Date.now(),
        updatedAt: Date.now(),
        ...styleProps
      });
    }

    figma.ui.postMessage({ type: 'progress', message: 'Scan complete!', progress: 100 });
    console.log('Collected elements:', elements.length, 'Sample:', elements.length > 0 ? elements[0] : {});
    return elements;
  } catch (error) {
    console.error('Error collecting design system elements:', error);
    figma.ui.postMessage({ type: 'error', message: 'Collection Error: ' + error });
    throw error;
  }
}

// Update comparison function to check structure changes and new hash fields
function compareElements(previous: DesignSystemElement[], current: DesignSystemElement[]): Changes {
  console.log('Comparing elements. Previous count:', previous.length, 'Current count:', current.length);
  
  const previousMap = new Map(previous.map(item => [item.id, item]));
  const currentMap = new Map(current.map(item => [item.id, item]));
  const processedIds = new Set<string>();
  
  const modified = current.filter(item => {
    const prevItem = previousMap.get(item.id);
    if (!prevItem) return false;
    
    processedIds.add(item.id);
    
    // Compare based on the new hashed and direct properties
    const changes = {
      nameChanged: prevItem.name !== item.name,
      keyChanged: prevItem.key !== item.key,
      descriptionChanged: prevItem.description !== item.description,
      // variantPropsChanged: JSON.stringify(prevItem.variantProperties) !== JSON.stringify(item.variantProperties), // Compare original for debugging if needed
      variantPropsHashChanged: prevItem.variantPropertiesHash !== item.variantPropertiesHash, // Compare hash for actual change detection
      parentNameChanged: prevItem.parentName !== item.parentName,
      
      fillsHashChanged: prevItem.fillsHash !== item.fillsHash,
      strokesHashChanged: prevItem.strokesHash !== item.strokesHash,
      effectsHashChanged: prevItem.effectsHash !== item.effectsHash,
      propertiesHashChanged: prevItem.propertiesHash !== item.propertiesHash, 
      componentPropertiesHashChanged: prevItem.componentPropertiesHash !== item.componentPropertiesHash, 
      
      childrenIdsChanged: JSON.stringify(prevItem.childrenIds) !== JSON.stringify(item.childrenIds), 
      structureHashChanged: prevItem.structureHash !== item.structureHash
    };
    
    const hasChanges = (() => {
      for (const key in changes) {
        if ((changes as any)[key] === true) {
          return true;
        }
      }
      return false;
    })();
    
    if (hasChanges) {
      console.log('Element changes detected:', {
        id: item.id,
        name: item.name,
        type: item.type,
        detectedChanges: changes, // Log which specific properties changed
        // For debugging structure or children changes specifically:
        structureDebug: (changes.childrenIdsChanged || changes.structureHashChanged) ? {
          previousChildrenIds: prevItem.childrenIds,
          currentChildrenIds: item.childrenIds,
          previousStructureHash: prevItem.structureHash,
          currentStructureHash: item.structureHash
        } : undefined,
        // previousFull: prevItem, // Uncomment for very detailed debugging
        // currentFull: item      // Uncomment for very detailed debugging
      });
    }
    
    return hasChanges;
  });
  
  const added = current.filter(item => !processedIds.has(item.id) && !previousMap.has(item.id));
  const removed = previous.filter(item => !processedIds.has(item.id) && !currentMap.has(item.id));
  
  const result = { added, modified, removed };
  
  console.log('Comparison result:', {
    added: added.length,
    modified: modified.length,
    removed: removed.length,
    // Optionally log details of modified items if needed for debugging
    // modifiedDetails: modified.map(item => ({ id: item.id, name: item.name, type: item.type })) 
  });
  
  return result;
}

// Initialize tracking data
async function initializeTracking(): Promise<void> {
  try {
    const elements = await collectDesignSystemElements();
  
    // Save to shared plugin data (chunked)
    const trackingData = {
      timestamp: Date.now(),
      elements: elements
    };
    setStoredTrackingData(trackingData);
    
    // Notify UI
    figma.ui.postMessage({ 
      type: 'initialized', 
      count: elements.length 
    });
  } catch (error) {
    console.error('Error initializing tracking:', error);
    figma.ui.postMessage({
      type: 'error',
      message: 'Failed to initialize tracking: ' + (error instanceof Error ? error.message : String(error))
    });
  }
}

// Update stored tracking data
async function updateTrackingData(notifyUI: boolean = true): Promise<void> {
  console.log(`updateTrackingData called. notifyUI: ${notifyUI}`);
  try {
    const elements = await collectDesignSystemElements();
    
    console.log('updateTrackingData: Current elements collected:', elements.length);
    
    const previousData = getStoredTrackingData();
    if (previousData) {
      console.log('updateTrackingData: Previous elements from storage:', previousData.elements.length);
      const changes = compareElements(previousData.elements, elements);
      console.log('updateTrackingData: Changes if we were to compare now (for debug):', {
        added: changes.added.length,
        modified: changes.modified.length,
        removed: changes.removed.length
      });
    }
    
    const trackingData = {
      timestamp: Date.now(),
      elements: elements
    };
    console.log(`updateTrackingData: Preparing to save ${trackingData.elements.length} elements with timestamp ${trackingData.timestamp}`);
    setStoredTrackingData(trackingData);
    
    if (notifyUI) {
      console.log("updateTrackingData: Notifying UI with 'updated' message.");
      figma.ui.postMessage({ 
        type: 'updated', 
        count: elements.length 
      });
    }
  } catch (error) {
    console.error('updateTrackingData: Error:', error);
    figma.ui.postMessage({
      type: 'error',
      message: 'Failed to update tracking data: ' + (error instanceof Error ? error.message : String(error))
    });
  }
}

// Scan and compare with debug logging
async function scanAndCompare(): Promise<void> {
  console.log('scanAndCompare: Called.');
  try {
    figma.ui.postMessage({ type: 'progress', message: 'Scanning current elements...', progress: 0 });
    const currentElements = await collectDesignSystemElements();
    console.log('scanAndCompare: Current elements collected:', currentElements.length);
    
    figma.ui.postMessage({ type: 'progress', message: 'Fetching stored data...', progress: 50 });
    const storedData = getStoredTrackingData();
    
    if (!storedData) {
      console.log('scanAndCompare: No stored data found. Reporting scanComplete with no changes.');
      figma.ui.postMessage({ 
        type: 'scanComplete', 
        count: currentElements.length,
        hasChanges: false
      });
      return;
    }
    
    console.log('scanAndCompare: Stored elements from storage:', storedData.elements.length, 'Timestamp:', storedData.timestamp);
    
    figma.ui.postMessage({ type: 'progress', message: 'Comparing elements...', progress: 75 });
    const changes = compareElements(storedData.elements, currentElements);
    
    console.log('scanAndCompare: Changes to be sent to UI:', {
      added: changes.added.length,
      modified: changes.modified.length,
      removed: changes.removed.length
    });
    
    figma.ui.postMessage({ type: 'progress', message: 'Finalizing scan...', progress: 100 });
    figma.ui.postMessage({
      type: 'changes',
      changes: changes,
      timestamp: Date.now(), // Use current time for the "changes" message timestamp
      hasChanges: changes.added.length > 0 || changes.modified.length > 0 || changes.removed.length > 0
    });
  } catch (error) {
    console.error('scanAndCompare: Error:', error);
    figma.ui.postMessage({
      type: 'error',
      message: 'Failed to scan for changes: ' + (error instanceof Error ? error.message : String(error))
    });
  }
}

// Format design system element for display
function formatElementForDisplay(element: DesignSystemElement): string {
  let formattedType = '';
  
  switch (element.type) {
    case 'component':
      formattedType = 'Component';
      break;
    case 'componentSet':
      formattedType = 'Component Set';
      break;
    case 'textStyle':
      formattedType = 'Text Style';
      break;
    case 'colorStyle':
      formattedType = 'Color Style';
      break;
    case 'effectStyle':
      formattedType = 'Effect Style';
      break;
    case 'gridStyle':
      formattedType = 'Grid Style';
      break;
    case 'variableCollection':
      formattedType = 'Variable Collection';
      break;
    case 'variable':
      formattedType = 'Variable';
      break;
    default:
      formattedType = element.type.charAt(0).toUpperCase() + element.type.slice(1);
  }
  
  // Handle variant components
  if (element.type === 'component' && element.variantProperties && Object.keys(element.variantProperties).length > 0) {
    // If we have the parent component set name, use it instead of the component's name
    const baseName = element.parentName || element.name.split('/')[0];
    
    // Format variant properties as Prop1=Value1, Prop2=Value2
    const variantProps = element.variantProperties;
    const propKeys = Object.keys(variantProps);
    
    // Filter out any empty values or properties that might duplicate the parent name
    const filteredProps = propKeys.filter(prop => {
      const value = variantProps[prop];
      return value && value.trim() !== '' && value.toLowerCase() !== baseName.toLowerCase();
    });
    
    if (filteredProps.length > 0) {
      const variantPropsString = filteredProps
        .map(prop => `${prop}=${variantProps[prop]}`)
        .join(', ');
      
      return `${formattedType} – ${baseName} (${variantPropsString})`;
    }
  }
  
  return `${formattedType} – ${element.name}`;
}

// Create a text node with logify entry
async function addToFigma(changes: Changes): Promise<void> {
  try {
    // Load required fonts
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    await figma.loadFontAsync({ family: "Inter", style: "Medium" });
    await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });
    
    // Find or create the 🖹Logify page
    let changelogPage = figma.root.children.find(page => page.name === LOGIFY_PAGE_NAME) as PageNode;
    if (!changelogPage) {
      changelogPage = figma.createPage();
      changelogPage.name = LOGIFY_PAGE_NAME;
    }
    
    await changelogPage.loadAsync();
    
    // Find or create the main container frame
    let mainContainer = changelogPage.findOne(node => 
      node.type === "FRAME" && node.name === CHANGELOG_CONTAINER_NAME) as FrameNode;
    
    if (!mainContainer) {
      mainContainer = figma.createFrame();
      mainContainer.name = CHANGELOG_CONTAINER_NAME;
      mainContainer.layoutMode = "VERTICAL";
      mainContainer.primaryAxisSizingMode = "AUTO";
      mainContainer.counterAxisSizingMode = "FIXED";
      mainContainer.resize(360, mainContainer.height); // Fixed width 360px
      mainContainer.itemSpacing = 24; // 24px gap between entries
      mainContainer.paddingTop = mainContainer.paddingBottom = 24;
      mainContainer.paddingLeft = mainContainer.paddingRight = 24;
      mainContainer.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }]; // White background
      mainContainer.cornerRadius = 16; // 16px border radius
      mainContainer.strokes = [{ type: "SOLID", color: { r: 213/255, g: 215/255, b: 222/255 } }]; // Outline/Secondary
      mainContainer.strokeWeight = 1;
      
      // Add container to the page
      changelogPage.appendChild(mainContainer);
    }
    
    // Create a new changelog entry frame
    const entryFrame = figma.createFrame();
    entryFrame.name = ENTRY_NAME_PREFIX + " " + new Date().toISOString().split('T')[0];
    entryFrame.layoutMode = "VERTICAL";
    entryFrame.primaryAxisSizingMode = "AUTO";
    entryFrame.counterAxisSizingMode = "AUTO";
    entryFrame.layoutAlign = "STRETCH";
    entryFrame.itemSpacing = 16; // 16px gap between sections
    entryFrame.fills = [];
    
    // Create timestamp row with icon
    const date = new Date();
    const formattedDate = `🕐 ${date.toTimeString().substring(0, 5)} ${date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: 'numeric',
      year: 'numeric'
    }).replace(/(\d+)\/(\d+)\/(\d+)/, '$3/$1/$2')}`;
    
    const timestampText = figma.createText();
    timestampText.characters = formattedDate;
    timestampText.fontSize = 18; // Large size
    timestampText.fontName = { family: "Inter", style: "Semi Bold" };
    timestampText.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }]; // Text/Primary
    timestampText.lineHeight = { value: 20, unit: "PIXELS" }; // 111.111%
    entryFrame.appendChild(timestampText);
      
    // Define a helper function to create section frames
    const createSection = (title: string, items: DesignSystemElement[]): FrameNode => {
      const sectionFrame = figma.createFrame();
      sectionFrame.name = title;
      sectionFrame.layoutMode = "VERTICAL";
      sectionFrame.primaryAxisSizingMode = "AUTO";
      sectionFrame.counterAxisSizingMode = "AUTO";
      sectionFrame.layoutAlign = "STRETCH";
      sectionFrame.itemSpacing = 8; // 8px gap between items within section
      sectionFrame.fills = [];
          
      // Create section title with appropriate icon
      const titleText = figma.createText();
      let icon = "💡";
      if (title.includes("Changed")) icon = "✏️";
      if (title.includes("Removed")) icon = "🗑️";
      titleText.characters = `${icon} ${title.replace("+ ", "")}`;
      titleText.fontSize = 18; // Large size
      titleText.fontName = { family: "Inter", style: "Semi Bold" };
      titleText.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }]; // Text/Primary
      titleText.lineHeight = { value: 20, unit: "PIXELS" }; // 111.111%
      sectionFrame.appendChild(titleText);
          
      // Create items list
      const itemsFrame = figma.createFrame();
      itemsFrame.name = "Items";
      itemsFrame.layoutMode = "VERTICAL";
      itemsFrame.primaryAxisSizingMode = "AUTO";
      itemsFrame.counterAxisSizingMode = "AUTO";
      itemsFrame.layoutAlign = "STRETCH";
      itemsFrame.itemSpacing = 8;
      itemsFrame.fills = [];
          
      // Add each item
      for (const item of items) {
        const itemText = figma.createText();
        itemText.characters = formatElementForDisplay(item);
        itemText.fontSize = 12; // Small size
        itemText.fontName = { family: "Inter", style: "Regular" };
        itemText.fills = [{ type: "SOLID", color: { r: 83/255, g: 88/255, b: 98/255 } }]; // Text/Secondary
        itemsFrame.appendChild(itemText);
      }
      
      sectionFrame.appendChild(itemsFrame);
      return sectionFrame;
    };
    
    // Add sections for added, modified, and removed items (only if they exist)
    if (changes.added.length > 0) {
      const addedSection = createSection("+ Added", changes.added);
      entryFrame.appendChild(addedSection);
    }
    
    if (changes.modified.length > 0) {
      const modifiedSection = createSection("Changed", changes.modified);
      entryFrame.appendChild(modifiedSection);
    }
    
    if (changes.removed.length > 0) {
      const removedSection = createSection("Removed", changes.removed);
      entryFrame.appendChild(removedSection);
    }
    
    // Prepend the entry frame to the container (newest at the top)
    if (mainContainer.children.length > 0) {
      mainContainer.insertChild(0, entryFrame);
    } else {
      mainContainer.appendChild(entryFrame);
    }
    
    // Switch to the logify page - using async method for dynamic-page support
    await figma.setCurrentPageAsync(changelogPage);
    
    // Update tracking data
    await updateTrackingData(false);
    
    // Notify UI
    figma.ui.postMessage({ type: 'addedToFigma' });
    figma.notify('Logify entry added to 🖹Logify page');
  } catch (error) {
    console.error('Error adding to Figma:', error);
    figma.ui.postMessage({ 
      type: 'error',
      message: 'Failed to add to Figma: ' + (error instanceof Error ? error.message : String(error))
    });
  }
}

// Handle UI messages
figma.ui.onmessage = async (msg: PluginMessage) => {
  if (msg.type === 'initialize') {
    await initializeTracking();
  } else if (msg.type === 'refresh') {
    await scanAndCompare();
  } else if (msg.type === 'addToFigma') {
    if (msg.changes) {
      // Validate changes data before processing
      if (!validateChanges(msg.changes)) {
        console.error('Invalid changes data received');
        figma.notify('Invalid data format', { error: true });
        return;
      }
      await addToFigma(msg.changes);
    } else {
      figma.notify('No changes to add to Figma', { error: true });
    }
  } else if (msg.type === 'viewRecords') {
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
  }
};

// Start the plugin
initializePlugin();
