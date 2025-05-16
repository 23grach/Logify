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

// Main entry point
  figma.showUI(__html__, { width: 400, height: 500 });

// Initialize plugin
async function initializePlugin(): Promise<void> {
  try {
    // Check if we have existing tracking data
    const storedData = await figma.clientStorage.getAsync('trackingData') as TrackingData | null;
    
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
        elements.push({
          id: component.id,
          name: component.name,
          type: 'component',
          key: component.key
        });
      }
      
      // Add component sets to the list
      for (const componentSet of componentSets) {
        elements.push({
          id: componentSet.id,
          name: componentSet.name,
          type: 'componentSet',
          key: componentSet.key
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
      key: style.key
    });
  }
  
    // Add color styles
    for (const style of colorStyles) {
      elements.push({
      id: style.id,
      name: style.name,
        type: 'colorStyle',
      key: style.key
    });
  }
  
    // Add effect styles
  for (const style of effectStyles) {
      elements.push({
      id: style.id,
      name: style.name,
        type: 'effectStyle',
      key: style.key
    });
  }
  
    // Add grid styles
  for (const style of gridStyles) {
      elements.push({
      id: style.id,
      name: style.name,
        type: 'gridStyle',
      key: style.key
    });
  }
  
    // Get variables and collections
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
    
    // Add variable collections and their variables
  for (const collection of collections) {
      elements.push({
      id: collection.id,
      name: collection.name,
      type: 'variableCollection'
    });
    
    // Add all variables in this collection
    const variableIds = collection.variableIds;
    for (const id of variableIds) {
      const variable = await figma.variables.getVariableByIdAsync(id);
      if (variable) {
          elements.push({
          id: variable.id,
          name: variable.name,
          type: 'variable',
          key: variable.key
        });
      }
    }
  }
  
    return elements;
  } catch (error) {
    console.error('Error collecting design system elements:', error);
    throw error;
  }
}

// Compare current elements with stored elements
async function scanAndCompare(): Promise<void> {
  try {
    // Get current elements
    const currentElements = await collectDesignSystemElements();
    
    // Get stored elements
    const storedData = await figma.clientStorage.getAsync('trackingData') as TrackingData | null;
    
    if (!storedData) {
      // No stored data - send total count message
      figma.ui.postMessage({ 
        type: 'scanComplete', 
        count: currentElements.length,
        hasChanges: false
      });
      return;
    }
    
    // Compare current vs stored elements
    const changes = compareElements(storedData.elements, currentElements);
    
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

// Compare two sets of elements
function compareElements(previous: DesignSystemElement[], current: DesignSystemElement[]): Changes {
  // Create maps for faster lookup
  const previousMap = new Map(previous.map(item => [item.id, item]));
  const currentMap = new Map(current.map(item => [item.id, item]));
  
  // Find added elements (in current but not in previous)
  const added = current.filter(item => !previousMap.has(item.id));
  
  // Find removed elements (in previous but not in current)
  const removed = previous.filter(item => !currentMap.has(item.id));
  
  // Find modified elements (name changed)
  const modified = current.filter(item => {
    const prevItem = previousMap.get(item.id);
    return prevItem && prevItem.name !== item.name;
  });
  
  return {
    added,
    modified,
    removed
  };
}

// Initialize tracking data
async function initializeTracking(): Promise<void> {
  try {
    const elements = await collectDesignSystemElements();
  
    // Save to client storage
    await figma.clientStorage.setAsync('trackingData', {
      timestamp: Date.now(),
      elements: elements
    });
    
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
    
    // Save to client storage
    await figma.clientStorage.setAsync('trackingData', {
      timestamp: Date.now(),
      elements: elements
    });
    
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
    const storedData = await figma.clientStorage.getAsync('trackingData') as TrackingData | null;
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
