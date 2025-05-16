/// <reference types="@figma/plugin-typings" />

// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

// This plugin shows changes in a Figma library since the last check

// Define types for our plugin
interface LibraryItem {
  id: string;
  name: string;
  type: string;
  key?: string;
  description?: string;
  updatedAt?: string;
}

interface ChangelogData {
  timestamp: number;
  added: LibraryItem[];
  removed: LibraryItem[];
  modified: LibraryItem[];
}

interface ChangelogEntry {
  id: string; // Unique ID for this changelog entry
  timestamp: number;
  added: LibraryItem[];
  removed: LibraryItem[];
  modified: LibraryItem[];
  syncedToFigma: boolean; // Whether this entry has been written to the Figma page
}

interface PluginMessage {
  type: string;
  insertPosition?: 'top' | 'bottom';
  [key: string]: any;
}

interface PluginSettings {
  insertPosition: 'top' | 'bottom';
}

// Default settings
const DEFAULT_SETTINGS: PluginSettings = {
  insertPosition: 'top'
};

// Main plugin code
async function main(): Promise<void> {
  // Show UI with a loading indicator
  figma.showUI(__html__, { width: 400, height: 500 });
  figma.ui.postMessage({ type: 'loading' });

  try {
    // Load settings
    const settings = await loadSettings();

    // Load all pages before accessing them
    await figma.loadAllPagesAsync();
    
    // Get components, styles, variables from the document
    const localComponentSets = await getComponentSets();
    const localComponents = await getComponents();
    const localStyles = await getStyles();
    const localVariables = await getVariableCollections();
    
    // Merge all items into one list
    const currentLibraryItems = [
      ...localComponentSets,
      ...localComponents, 
      ...localStyles,
      ...localVariables
    ];
    
    // Load previous state from clientStorage
    const previousLibraryItems = await getPreviousState();
    
    // If this is the first run, save the current state and inform user
    if (!previousLibraryItems || previousLibraryItems.length === 0) {
      await saveCurrentState(currentLibraryItems);
      figma.ui.postMessage({ 
        type: 'firstRun',
        count: currentLibraryItems.length,
        timestamp: Date.now(),
        settings: settings
      });
      return;
    }
    
    // Compare current state with previous state
    const changelog = compareLibraryStates(previousLibraryItems, currentLibraryItems);
    
    // Check if there are any changes
    const hasChanges = changelog.added.length > 0 || 
                      changelog.removed.length > 0 || 
                      changelog.modified.length > 0;
    
    if (hasChanges) {
      // Store this changelog entry in pending entries
      await addPendingChangelogEntry(changelog);
    }
    
    // Check if any pending entries need to be written to the Figma page
    const pendingEntries = await getPendingChangelogEntries();
    const hasPendingChanges = pendingEntries.some(entry => !entry.syncedToFigma);
    
    // Send changelog data to the UI
    figma.ui.postMessage({ 
      type: 'changelog',
      data: changelog,
      settings: settings,
      changelogUpdated: false, // Always false on initial load
      hasPendingChanges: hasPendingChanges
    });
  } catch (error: any) {
    console.error('Error:', error);
    figma.ui.postMessage({ 
      type: 'error',
      message: 'Failed to generate changelog: ' + error.message
    });
    figma.notify('Failed to generate changelog: ' + error.message, { error: true });
  }
}

// Get component sets from the document
async function getComponentSets(): Promise<LibraryItem[]> {
  const componentSets: LibraryItem[] = [];
  
  // Iterate through all pages to find component sets
  for (const page of figma.root.children) {
    try {
      // Ensure the page is loaded
      await page.loadAsync();

      // Skip private pages in team libraries
      if (page.getSharedPluginData('figma', 'private') === 'true') {
        continue;
      }
      
      // Find component sets
      page.findAllWithCriteria({ types: ['COMPONENT_SET'] })
        .forEach((node) => {
          componentSets.push({
            id: node.id,
            name: node.name,
            type: 'componentSet',
            key: node.key
          });
        });
    } catch (err) {
      // Skip this page if it cannot be loaded
      console.warn(`Could not process page: ${page.name}`, err);
    }
  }
  
  return componentSets;
}

// Get components from the document
async function getComponents(): Promise<LibraryItem[]> {
  const components: LibraryItem[] = [];
  
  // Iterate through all pages to find components
  for (const page of figma.root.children) {
    try {
      // Ensure the page is loaded
      await page.loadAsync();

      // Skip private pages in team libraries
      if (page.getSharedPluginData('figma', 'private') === 'true') {
        continue;
      }
      
      // Find components
      page.findAllWithCriteria({ types: ['COMPONENT'] })
        .forEach((node) => {
          components.push({
            id: node.id,
            name: node.name,
            type: 'component',
            key: node.key
          });
        });
    } catch (err) {
      // Skip this page if it cannot be loaded
      console.warn(`Could not process page: ${page.name}`, err);
    }
  }
  
  return components;
}

// Get styles from the document
async function getStyles(): Promise<LibraryItem[]> {
  const styles: LibraryItem[] = [];
  
  // Get text styles
  const textStyles = await figma.getLocalTextStylesAsync();
  for (const style of textStyles) {
    styles.push({
      id: style.id,
      name: style.name,
      type: 'style:text',
      key: style.key
    });
  }
  
  // Get paint styles
  const paintStyles = await figma.getLocalPaintStylesAsync();
  for (const style of paintStyles) {
    styles.push({
      id: style.id,
      name: style.name,
      type: 'style:paint',
      key: style.key
    });
  }
  
  // Get effect styles
  const effectStyles = await figma.getLocalEffectStylesAsync();
  for (const style of effectStyles) {
    styles.push({
      id: style.id,
      name: style.name,
      type: 'style:effect',
      key: style.key
    });
  }
  
  // Get grid styles
  const gridStyles = await figma.getLocalGridStylesAsync();
  for (const style of gridStyles) {
    styles.push({
      id: style.id,
      name: style.name,
      type: 'style:grid',
      key: style.key
    });
  }
  
  return styles;
}

// Get variable collections from the document
async function getVariableCollections(): Promise<LibraryItem[]> {
  const variableCollections: LibraryItem[] = [];
  
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  for (const collection of collections) {
    // Add the collection itself
    variableCollections.push({
      id: collection.id,
      name: collection.name,
      type: 'variableCollection'
    });
    
    // Add all variables in this collection
    const variableIds = collection.variableIds;
    for (const id of variableIds) {
      const variable = await figma.variables.getVariableByIdAsync(id);
      if (variable) {
        variableCollections.push({
          id: variable.id,
          name: variable.name,
          type: 'variable',
          key: variable.key
        });
      }
    }
  }
  
  return variableCollections;
}

// Compare previous and current library states to find changes
function compareLibraryStates(
  previous: LibraryItem[], 
  current: LibraryItem[]
): ChangelogData {
  // Create maps for faster lookup
  const previousMap = new Map(previous.map(item => [item.id, item]));
  const currentMap = new Map(current.map(item => [item.id, item]));
  
  // Find added items (in current but not in previous)
  const added = current.filter(item => !previousMap.has(item.id));
  
  // Find removed items (in previous but not in current)
  const removed = previous.filter(item => !currentMap.has(item.id));
  
  // Find modified items (name or other property changed)
  const modified = current.filter(item => {
    const prevItem = previousMap.get(item.id);
    return prevItem && (
      prevItem.name !== item.name || 
      prevItem.description !== item.description
    );
  });
  
  return {
    timestamp: Date.now(),
    added,
    removed,
    modified
  };
}

// Find or create a page with the given name
async function findOrCreatePage(pageName: string): Promise<PageNode> {
  // Try to find an existing changelog page
  let changelogPage = figma.root.children.find(page => page.name === pageName);
  
  // If the page doesn't exist, create it
  if (!changelogPage) {
    changelogPage = figma.createPage();
    changelogPage.name = pageName;
  } else {
    // Make sure the page is loaded if it already exists
    await changelogPage.loadAsync();
  }
  
  return changelogPage;
}

// Format changelog text for display in the Figma page
function formatChangelogText(changelog: ChangelogData): string {
  const date = new Date(changelog.timestamp);
  const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
  const timeString = date.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
  
  let text = `${dateString} ${timeString}\n\n`;
  
  // Add 'Added' section if there are added items
  if (changelog.added.length > 0) {
    text += 'Added:\n';
    for (const item of changelog.added) {
      text += `- ${formatItemType(item.type)}: ${item.name}\n`;
    }
    text += '\n';
  }
  
  // Add 'Removed' section if there are removed items
  if (changelog.removed.length > 0) {
    text += 'Removed:\n';
    for (const item of changelog.removed) {
      text += `- ${formatItemType(item.type)}: ${item.name}\n`;
    }
    text += '\n';
  }
  
  // Add 'Modified' section if there are modified items
  if (changelog.modified.length > 0) {
    text += 'Modified:\n';
    for (const item of changelog.modified) {
      const prevItem = item; // In this simplified version, we don't track previous values
      if (prevItem.name !== item.name) {
        text += `- ${formatItemType(item.type)}: ${prevItem.name} → ${item.name}\n`;
      } else {
        text += `- ${formatItemType(item.type)}: ${item.name}\n`;
      }
    }
    text += '\n';
  }
  
  return text;
}

// Format item type for display
function formatItemType(type: string): string {
  if (type === 'component') {
    return 'Component';
  } else if (type === 'componentSet') {
    return 'Component Set';
  } else if (type === 'variableCollection') {
    return 'Variable Collection';
  } else if (type === 'variable') {
    return 'Variable';
  } else if (type.startsWith('style:')) {
    const styleType = type.replace('style:', '');
    switch (styleType) {
      case 'text':
        return 'Text Style';
      case 'paint':
        return 'Color Style';
      case 'grid':
        return 'Grid Style';
      case 'effect':
        return 'Effect Style';
      default:
        return styleType.charAt(0).toUpperCase() + styleType.slice(1) + ' Style';
    }
  }
  
  // Return a capitalized version of the type as a fallback
  return type.charAt(0).toUpperCase() + type.slice(1);
}

// Update the Figma page with the changelog
async function updateChangelogPage(settings: PluginSettings): Promise<void> {
  try {
    // Get pending changelog entries that haven't been synced to Figma
    const pendingEntries = await getPendingChangelogEntries();
    const unsyncedEntries = pendingEntries.filter(entry => !entry.syncedToFigma);
    
    if (unsyncedEntries.length === 0) {
      figma.notify('No pending changes to update in Figma page.');
      return;
    }
    
    // Find or create the changelog page
    const changelogPage = await findOrCreatePage('🖹Changelog');
    
    // Find or create the main container 
    let mainContainer = changelogPage.findOne(node => 
      node.type === 'FRAME' && node.name === 'Changelog-Container') as FrameNode;
    
    // If the main container doesn't exist, create it
    if (!mainContainer) {
      mainContainer = figma.createFrame();
      mainContainer.name = 'Changelog-Container';
      mainContainer.layoutMode = 'VERTICAL';
      mainContainer.primaryAxisSizingMode = 'AUTO';
      mainContainer.counterAxisSizingMode = 'FIXED';
      mainContainer.itemSpacing = 24; // Gap between entries
      mainContainer.paddingTop = mainContainer.paddingBottom = 24;
      mainContainer.paddingLeft = mainContainer.paddingRight = 24;
      mainContainer.fills = []; // Transparent background
      mainContainer.resize(800, 100); // Initial size, will auto-resize with content
      
      // Add container to the page
      changelogPage.appendChild(mainContainer);
    }
    
    // Load the required font
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
    await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
    
    // Process each unsynced entry
    for (const entry of unsyncedEntries) {
      // Format timestamp for the entry
      const date = new Date(entry.timestamp);
      const formattedDate = `🕦 ${date.toTimeString().substring(0, 5)} ${date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })}`;
      
      // Create the frame for this changelog entry
      const entryFrame = figma.createFrame();
      entryFrame.name = formattedDate;
      entryFrame.resize(480, 100); // Set width to 480px, height will adjust with auto layout
      entryFrame.layoutMode = 'VERTICAL';
      entryFrame.primaryAxisSizingMode = 'AUTO';
      entryFrame.counterAxisSizingMode = 'FIXED';
      entryFrame.itemSpacing = 16; // Gap inside entries
      entryFrame.paddingTop = entryFrame.paddingRight = entryFrame.paddingBottom = entryFrame.paddingLeft = 24;
      entryFrame.cornerRadius = 12;
      entryFrame.strokes = [{ type: 'SOLID', color: { r: 0.83, g: 0.84, b: 0.85 } }];
      entryFrame.strokeWeight = 1;
      entryFrame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
      
      // Create timestamp text
      const timestampText = figma.createText();
      timestampText.characters = formattedDate;
      timestampText.fontSize = 18;
      timestampText.fontName = { family: 'Inter', style: 'Regular' };
      entryFrame.appendChild(timestampText);
      
      // Add sections for added, modified, and removed items
      const sections = [
        { items: entry.added, title: '➕ Added' },
        { items: entry.modified, title: 'Modified' },
        { items: entry.removed, title: 'Removed' }
      ];
      
      // Create each section that has items
      for (const section of sections) {
        if (section.items.length > 0) {
          // Create section container
          const sectionContainer = figma.createFrame();
          sectionContainer.name = `V-Container - ${section.title}`;
          sectionContainer.layoutMode = 'VERTICAL';
          sectionContainer.primaryAxisSizingMode = 'AUTO';
          sectionContainer.counterAxisSizingMode = 'AUTO';
          sectionContainer.itemSpacing = 8; // Gap between items in a section
          sectionContainer.fills = []; // No background
          
          // Create section title
          const sectionTitle = figma.createText();
          sectionTitle.characters = section.title;
          sectionTitle.fontSize = 18;
          sectionTitle.fontName = { family: 'Inter', style: 'Medium' };
          sectionContainer.appendChild(sectionTitle);
          
          // Create items container
          const itemsContainer = figma.createFrame();
          itemsContainer.name = `V-Container - ${section.items[0] ? formatItemType(section.items[0].type) + ' - ' + section.items[0].name : 'Items'}`;
          itemsContainer.layoutMode = 'VERTICAL';
          itemsContainer.primaryAxisSizingMode = 'AUTO';
          itemsContainer.counterAxisSizingMode = 'FIXED';
          itemsContainer.itemSpacing = 8;
          itemsContainer.fills = []; // No background
          
          // Add each item
          for (const item of section.items) {
            const itemText = figma.createText();
            
            if (section.title === 'Modified') {
              // For modified items, show the change
              const prevItem = item; // In this simplified version, we don't track previous values
              // Check if the name has changed
              if (prevItem.name !== item.name) {
                itemText.characters = `${formatItemType(item.type)} ${prevItem.name} → ${item.name}`;
              } else {
                itemText.characters = `${formatItemType(item.type)} ${item.name}`;
              }
            } else {
              // For added or removed items
              itemText.characters = `${formatItemType(item.type)} - ${item.name}`;
            }
            
            itemText.fontSize = 18;
            itemText.fontName = { family: 'Inter', style: 'Regular' };
            itemsContainer.appendChild(itemText);
          }
          
          sectionContainer.appendChild(itemsContainer);
          entryFrame.appendChild(sectionContainer);
        }
      }
      
      // Add the entry frame to the container (newest entries at the top)
      if (mainContainer.children.length > 0) {
        // Insert at the top (index 0)
        mainContainer.insertChild(0, entryFrame);
      } else {
        // If it's the first child, just append it
        mainContainer.appendChild(entryFrame);
      }
      
      // Mark this entry as synced
      entry.syncedToFigma = true;
    }
    
    // Save updated entries back to clientStorage
    await savePendingChangelogEntries(pendingEntries);
    
    // Send success notification
    figma.notify('Changelog updated in Figma page.');
    
    // Update UI
    figma.ui.postMessage({ 
      type: 'changelog-updated', 
      message: 'Changelog updated in Figma page.'
    });
    
  } catch (error: any) {
    console.error('Error updating changelog page:', error);
    figma.notify('Failed to update changelog page: ' + error.message, { error: true });
  }
}

// Generate a unique ID for changelog entries
function generateUniqueId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

// Save the current library state to clientStorage
async function saveCurrentState(libraryItems: LibraryItem[]): Promise<void> {
  await figma.clientStorage.setAsync('baselineSnapshot', JSON.stringify(libraryItems));
  await figma.clientStorage.setAsync('lastUpdatedAt', Date.now().toString());
}

// Get the previous library state from clientStorage
async function getPreviousState(): Promise<LibraryItem[]> {
  const data = await figma.clientStorage.getAsync('baselineSnapshot');
  return data ? JSON.parse(data) : [];
}

// Add a new changelog entry to the pending entries
async function addPendingChangelogEntry(changelog: ChangelogData): Promise<void> {
  const pendingEntries = await getPendingChangelogEntries();
  
  const newEntry: ChangelogEntry = {
    id: generateUniqueId(),
    timestamp: changelog.timestamp,
    added: changelog.added,
    removed: changelog.removed,
    modified: changelog.modified,
    syncedToFigma: false
  };
  
  pendingEntries.push(newEntry);
  await savePendingChangelogEntries(pendingEntries);
}

// Get all pending changelog entries from clientStorage
async function getPendingChangelogEntries(): Promise<ChangelogEntry[]> {
  const data = await figma.clientStorage.getAsync('pendingChangelogEntries');
  return data ? JSON.parse(data) : [];
}

// Save pending changelog entries to clientStorage
async function savePendingChangelogEntries(entries: ChangelogEntry[]): Promise<void> {
  await figma.clientStorage.setAsync('pendingChangelogEntries', JSON.stringify(entries));
}

// Save plugin settings to clientStorage
async function saveSettings(settings: PluginSettings): Promise<void> {
  await figma.clientStorage.setAsync('settings', JSON.stringify(settings));
}

// Load plugin settings from clientStorage
async function loadSettings(): Promise<PluginSettings> {
  const data = await figma.clientStorage.getAsync('settings');
  return data ? JSON.parse(data) : DEFAULT_SETTINGS;
}

// Reset all plugin data
async function resetPluginData(): Promise<void> {
  await figma.clientStorage.setAsync('baselineSnapshot', '');
  await figma.clientStorage.setAsync('lastUpdatedAt', '');
  await figma.clientStorage.setAsync('pendingChangelogEntries', '');
  
  // We keep the settings to maintain user preferences
  figma.notify('Library has been reset. Click "Sync Library" to set a new baseline.');
  
  figma.ui.postMessage({ 
    type: 'reset-complete'
  });
}

// Handle messages from the UI
figma.ui.onmessage = async (msg: PluginMessage) => {
  if (msg.type === 'update-changelog') {
    // Update the Figma page with pending changelog entries
    const settings = await loadSettings();
    await updateChangelogPage(settings);
  } else if (msg.type === 'refresh') {
    // Re-run the main function to refresh the changelog
    await main();
  } else if (msg.type === 'reset-baseline') {
    // Reset all plugin data
    await resetPluginData();
  } else if (msg.type === 'update-settings') {
    // Update plugin settings
    await saveSettings(msg.settings);
    figma.ui.postMessage({ type: 'settings-updated' });
    
    // Refresh UI with updated settings
    await main();
  } else if (msg.type === 'notify') {
    // Show a notification using Figma's native notification system
    figma.notify(msg.message);
  } else if (msg.type === 'notify-error') {
    // Show an error notification using Figma's native notification system
    figma.notify(msg.message, { error: true });
  }
};

// Start the plugin
main();
