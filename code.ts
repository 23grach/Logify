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
  type: string;
  key?: string;
  description?: string;
  variantProperties?: { [property: string]: string } | null;
  parentName?: string;
  modifiedAt?: number;
  updatedAt?: number;
  // Add properties for tracking visual changes
  fills?: string;
  strokes?: string;
  effects?: string;
  styles?: { [key: string]: string };
  componentProperties?: string;
  // Add structure tracking
  children?: string;
  structure?: string;
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

// Helper functions for shared data storage
function getStoredTrackingData(): TrackingData | null {
  try {
    const storedDataStr = figma.root.getSharedPluginData(PLUGIN_NAMESPACE, TRACKING_DATA_KEY);
    console.log('Raw stored data:', storedDataStr);
    if (!storedDataStr) return null;
    const data = JSON.parse(storedDataStr) as TrackingData;
    console.log('Parsed stored data:', data);
    return data;
  } catch (error) {
    console.error('Error parsing stored data:', error);
    return null;
  }
}

function setStoredTrackingData(data: TrackingData): void {
  figma.root.setSharedPluginData(PLUGIN_NAMESPACE, TRACKING_DATA_KEY, JSON.stringify(data));
}

// Main entry point
figma.showUI(__html__, { width: 400, height: 500 });

// Initialize plugin
async function initializePlugin(): Promise<void> {
  try {
    // Check if we have existing tracking data
    const storedData = getStoredTrackingData();
    
    if (!storedData) {
      // First time use - show initialization screen
      figma.ui.postMessage({ type: 'init' });
    } else {
      // Compare current elements with stored elements
      await scanAndCompare();
    }
  } catch (error) {
    console.error('Error initializing plugin:', error);
    figma.ui.postMessage({ 
      type: 'error',
      message: 'Failed to initialize: ' + (error instanceof Error ? error.message : String(error))
    });
  }
}

// Helper function to serialize node structure
function serializeNodeStructure(node: SceneNode): string {
  try {
    // Basic node info
    const nodeInfo: any = {
      id: node.id,
      name: node.name,
      type: node.type,
      visible: node.visible,
      locked: node.locked
    };
    
    // Add children recursively if the node is a parent type
    if ('children' in node) {
      nodeInfo.children = (node as FrameNode | ComponentNode | ComponentSetNode | InstanceNode).children.map(child => serializeNodeStructure(child));
    }
    
    return JSON.stringify(nodeInfo);
  } catch (error) {
    console.error('Error serializing node structure:', error);
    return '';
  }
}

// Helper function to serialize visual properties
function serializeVisualProperties(node: ComponentNode | ComponentSetNode | BaseStyle): {
  fills?: string;
  strokes?: string;
  effects?: string;
  styles?: { [key: string]: string };
  componentProperties?: string;
  children?: string;
  structure?: string;
} {
  const result: any = {};
  
  try {
    // Serialize fills
    if ('fills' in node && node.fills) {
      result.fills = JSON.stringify(node.fills);
    }
    
    // Serialize strokes
    if ('strokes' in node && node.strokes) {
      result.strokes = JSON.stringify(node.strokes);
    }
    
    // Serialize effects
    if ('effects' in node && node.effects) {
      result.effects = JSON.stringify(node.effects);
    }
    
    // Serialize styles
    if ('styles' in node && node.styles) {
      result.styles = JSON.stringify(node.styles);
    }
    
    // Serialize component properties
    if ('componentProperties' in node && node.componentProperties) {
      result.componentProperties = JSON.stringify(node.componentProperties);
    }
    
    // Serialize children and structure for components and component sets
    if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
      // Get direct children IDs
      if ('children' in node) {
        result.children = JSON.stringify(node.children.map(child => child.id));
      }
      
      // Get full node structure including all nested elements
      result.structure = serializeNodeStructure(node);
    }
    
    return result;
  } catch (error) {
    console.error('Error serializing visual properties:', error);
    return {};
  }
}

// Collect all design system elements in the current file
async function collectDesignSystemElements(): Promise<DesignSystemElement[]> {
  const elements: DesignSystemElement[] = [];
  
  try {
    // Get components
    await figma.loadAllPagesAsync();
    
    // Process each page to find components
    for (const page of figma.root.children) {
      // Skip private pages if needed
      if (page.getSharedPluginData('figma', 'private') === 'true') {
        continue;
      }
      
      // Find components and component sets
      const components = page.findAllWithCriteria({ types: ['COMPONENT'] });
      const componentSets = page.findAllWithCriteria({ types: ['COMPONENT_SET'] });
      
      // Add components to the list
      for (const component of components) {
        // Store variant properties and parent name if available
        let variantProperties = null;
        
        // Try to get variant properties (both new and old API)
        if ('variantProperties' in component && component.variantProperties) {
          variantProperties = component.variantProperties;
        } else if ('componentProperties' in component && component.componentProperties) {
          // For newer Figma versions using componentProperties API
          variantProperties = {};
          
          try {
            const compProps = component.componentProperties as any;
            if (compProps && typeof compProps === 'object') {
              Object.keys(compProps).forEach(propName => {
                const propValue = compProps[propName];
                if (propValue && propValue.type === 'VARIANT' && propValue.value) {
                  variantProperties![propName] = propValue.value;
                }
              });
            }
          } catch (err) {
            console.error('Error accessing component properties:', err);
          }
          
          // If no variant properties were found, set to null
          if (Object.keys(variantProperties).length === 0) {
            variantProperties = null;
          }
        }
        
        const parentName = component.parent && component.parent.type === 'COMPONENT_SET' ? component.parent.name : undefined;
        
        // Get visual properties
        const visualProps = serializeVisualProperties(component);
        
        elements.push({
          id: component.id,
          name: component.name,
          type: 'component',
          key: component.key,
          description: component.description,
          variantProperties,
          parentName,
          modifiedAt: Date.now(),
          updatedAt: Date.now(),
          ...visualProps
        });
      }
      
      // Add component sets to the list
      for (const componentSet of componentSets) {
        // Get visual properties
        const visualProps = serializeVisualProperties(componentSet);
        
        elements.push({
          id: componentSet.id,
          name: componentSet.name,
          type: 'componentSet',
          key: componentSet.key,
          description: componentSet.description,
          modifiedAt: Date.now(),
          updatedAt: Date.now(),
          ...visualProps
        });
      }
    }
    
    // Get styles
    const textStyles = await figma.getLocalTextStylesAsync();
    const colorStyles = await figma.getLocalPaintStylesAsync();
    const effectStyles = await figma.getLocalEffectStylesAsync();
    const gridStyles = await figma.getLocalGridStylesAsync();
    
    // Add text styles
    for (const style of textStyles) {
      elements.push({
        id: style.id,
        name: style.name,
        type: 'textStyle',
        key: style.key,
        description: style.description,
        modifiedAt: Date.now(),
        updatedAt: Date.now(),
        ...serializeVisualProperties(style)
      });
    }
    
    // Add color styles
    for (const style of colorStyles) {
      elements.push({
        id: style.id,
        name: style.name,
        type: 'colorStyle',
        key: style.key,
        description: style.description,
        modifiedAt: Date.now(),
        updatedAt: Date.now(),
        ...serializeVisualProperties(style)
      });
    }
    
    // Add effect styles
    for (const style of effectStyles) {
      elements.push({
        id: style.id,
        name: style.name,
        type: 'effectStyle',
        key: style.key,
        description: style.description,
        modifiedAt: Date.now(),
        updatedAt: Date.now(),
        ...serializeVisualProperties(style)
      });
    }
    
    // Add grid styles
    for (const style of gridStyles) {
      elements.push({
        id: style.id,
        name: style.name,
        type: 'gridStyle',
        key: style.key,
        description: style.description,
        modifiedAt: Date.now(),
        updatedAt: Date.now(),
        ...serializeVisualProperties(style)
      });
    }
    
    console.log('Collected elements:', elements);
    return elements;
  } catch (error) {
    console.error('Error collecting design system elements:', error);
    throw error;
  }
}

// Update comparison function to check structure changes
function compareElements(previous: DesignSystemElement[], current: DesignSystemElement[]): Changes {
  console.log('Comparing elements:', { previous, current });
  
  const previousMap = new Map(previous.map(item => [item.id, item]));
  const currentMap = new Map(current.map(item => [item.id, item]));
  const processedIds = new Set<string>();
  
  const modified = current.filter(item => {
    const prevItem = previousMap.get(item.id);
    if (!prevItem) return false;
    
    processedIds.add(item.id);
    
    const changes = {
      nameChanged: prevItem.name !== item.name,
      keyChanged: prevItem.key !== item.key,
      descriptionChanged: prevItem.description !== item.description,
      variantPropsChanged: JSON.stringify(prevItem.variantProperties) !== JSON.stringify(item.variantProperties),
      parentNameChanged: prevItem.parentName !== item.parentName,
      fillsChanged: prevItem.fills !== item.fills,
      strokesChanged: prevItem.strokes !== item.strokes,
      effectsChanged: prevItem.effects !== item.effects,
      stylesChanged: JSON.stringify(prevItem.styles) !== JSON.stringify(item.styles),
      componentPropertiesChanged: prevItem.componentProperties !== item.componentProperties,
      // Add structure change detection
      childrenChanged: prevItem.children !== item.children,
      structureChanged: prevItem.structure !== item.structure
    };
    
    const hasChanges = changes.nameChanged || 
                      changes.keyChanged || 
                      changes.descriptionChanged || 
                      changes.variantPropsChanged || 
                      changes.parentNameChanged ||
                      changes.fillsChanged ||
                      changes.strokesChanged ||
                      changes.effectsChanged ||
                      changes.stylesChanged ||
                      changes.componentPropertiesChanged ||
                      changes.childrenChanged ||
                      changes.structureChanged;
    
    if (hasChanges) {
      console.log('Element changes detected:', {
        id: item.id,
        name: item.name,
        changes,
        structureChange: changes.structureChanged || changes.childrenChanged ? {
          previousChildren: prevItem.children,
          currentChildren: item.children,
          previousStructure: prevItem.structure,
          currentStructure: item.structure
        } : undefined,
        previous: prevItem,
        current: item
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
    modifiedDetails: modified.map(item => ({
      id: item.id,
      name: item.name,
      type: item.type,
      changes: {
        previous: previousMap.get(item.id),
        current: item
      }
    }))
  });
  
  return result;
}

// Initialize tracking data
async function initializeTracking(): Promise<void> {
  try {
    const elements = await collectDesignSystemElements();
  
    // Save to shared plugin data
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
async function updateTrackingData(): Promise<void> {
  try {
    const elements = await collectDesignSystemElements();
    
    // Log current elements for debugging
    console.log('Current elements:', elements.length);
    
    // Get previous data for comparison
    const previousData = getStoredTrackingData();
    if (previousData) {
      console.log('Previous elements:', previousData.elements.length);
      
      // Compare and log changes
      const changes = compareElements(previousData.elements, elements);
      console.log('Changes before saving:', changes);
    }
    
    // Save to shared plugin data
    const trackingData = {
      timestamp: Date.now(),
      elements: elements
    };
    setStoredTrackingData(trackingData);
    
    // Notify UI
    figma.ui.postMessage({ 
      type: 'updated', 
      count: elements.length 
    });
  } catch (error) {
    console.error('Error updating tracking data:', error);
    figma.ui.postMessage({
      type: 'error',
      message: 'Failed to update tracking data: ' + (error instanceof Error ? error.message : String(error))
    });
  }
}

// Scan and compare with debug logging
async function scanAndCompare(): Promise<void> {
  try {
    // Get current elements
    const currentElements = await collectDesignSystemElements();
    console.log('Current elements in scan:', currentElements.length);
    
    // Get stored elements
    const storedData = getStoredTrackingData();
    
    if (!storedData) {
      console.log('No stored data found');
      figma.ui.postMessage({ 
        type: 'scanComplete', 
        count: currentElements.length,
        hasChanges: false
      });
      return;
    }
    
    console.log('Stored elements in scan:', storedData.elements.length);
    
    // Compare current vs stored elements
    const changes = compareElements(storedData.elements, currentElements);
    
    // Log changes before sending to UI
    console.log('Changes to be sent to UI:', {
      added: changes.added.length,
      modified: changes.modified.length,
      removed: changes.removed.length
    });
    
    // Send results to UI
    figma.ui.postMessage({
      type: 'changes',
      changes: changes,
      timestamp: Date.now(),
      hasChanges: changes.added.length > 0 || changes.modified.length > 0 || changes.removed.length > 0
    });
  } catch (error) {
    console.error('Error scanning for changes:', error);
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
    // The SemiBold style might not be available, use Medium instead
    // await figma.loadFontAsync({ family: "Inter", style: "SemiBold" });
    
    // Find or create the 🖹Logify page
    let changelogPage = figma.root.children.find(page => page.name === "🖹Logify") as PageNode;
    if (!changelogPage) {
      changelogPage = figma.createPage();
      changelogPage.name = "🖹Logify";
    }
    
    // Make sure the page is loaded
    await changelogPage.loadAsync();
    
    // Find or create the main container frame
    let mainContainer = changelogPage.findOne(node => 
      node.type === "FRAME" && node.name === "Logify Container") as FrameNode;
    
    if (!mainContainer) {
      mainContainer = figma.createFrame();
      mainContainer.name = "Logify Container";
      mainContainer.layoutMode = "VERTICAL";
      mainContainer.primaryAxisSizingMode = "AUTO";
      mainContainer.counterAxisSizingMode = "AUTO"; // Hug contents horizontally
      mainContainer.itemSpacing = 24; // 24px gap between entries
      mainContainer.paddingTop = mainContainer.paddingBottom = 0;
      mainContainer.paddingLeft = mainContainer.paddingRight = 0;
      mainContainer.fills = []; // Transparent background
      mainContainer.layoutAlign = "STRETCH";
      
      // Add container to the page
      changelogPage.appendChild(mainContainer);
    }
    
    // Create a new changelog entry frame
    const entryFrame = figma.createFrame();
    entryFrame.name = "Logify Entry " + new Date().toISOString().split('T')[0];
    entryFrame.layoutMode = "VERTICAL";
    entryFrame.primaryAxisSizingMode = "AUTO"; // Hug contents vertically
    entryFrame.counterAxisSizingMode = "AUTO"; // Hug contents horizontally
    entryFrame.itemSpacing = 16; // Gap between sections
    entryFrame.cornerRadius = 8;
    entryFrame.paddingTop = entryFrame.paddingBottom = entryFrame.paddingLeft = entryFrame.paddingRight = 16;
    entryFrame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    entryFrame.strokes = [{ type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 } }];
    entryFrame.strokeWeight = 1;
    
    // Create timestamp row with icon
    const date = new Date();
    const formattedDate = `🕓 ${date.toTimeString().substring(0, 5)} ${date.toLocaleDateString('en-US', {
      month: '2-digit',
        day: '2-digit',
        year: 'numeric'
    }).replace(/(\d+)\/(\d+)\/(\d+)/, '$1/$2/$3')}`;
    
      const timestampText = figma.createText();
      timestampText.characters = formattedDate;
    timestampText.fontSize = 14;
    timestampText.fontName = { family: "Inter", style: "Medium" }; // Use Medium instead of SemiBold
      entryFrame.appendChild(timestampText);
      
    // Define a helper function to create section frames
    const createSection = (title: string, items: DesignSystemElement[]): FrameNode => {
          // Create section container
      const sectionFrame = figma.createFrame();
      sectionFrame.name = title;
      sectionFrame.layoutMode = "VERTICAL";
      sectionFrame.primaryAxisSizingMode = "AUTO";
      sectionFrame.counterAxisSizingMode = "AUTO"; // Hug contents horizontally
      sectionFrame.itemSpacing = 12;
      sectionFrame.fills = []; // Transparent
          
          // Create section title
      const titleText = figma.createText();
      titleText.characters = title;
      titleText.fontSize = 14;
      titleText.fontName = { family: "Inter", style: "Medium" }; // Use Medium instead of SemiBold
      sectionFrame.appendChild(titleText);
          
      // Create items list
      const itemsFrame = figma.createFrame();
      itemsFrame.name = "Items";
      itemsFrame.layoutMode = "VERTICAL";
      itemsFrame.primaryAxisSizingMode = "AUTO";
      itemsFrame.counterAxisSizingMode = "AUTO"; // Hug contents horizontally
      itemsFrame.itemSpacing = 8;
      itemsFrame.fills = []; // Transparent
          
          // Add each item
      for (const item of items) {
            const itemText = figma.createText();
        itemText.characters = formatElementForDisplay(item);
        itemText.fontSize = 14;
        itemText.fontName = { family: "Inter", style: "Regular" };
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
    await updateTrackingData();
    
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
