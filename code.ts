/// <reference types="@figma/plugin-typings" />

/**
 * Figma Plugin: Logify - Design System Tracker
 * Tracks changes to design system elements and creates changelog entries
 */

// ======================== TYPES & INTERFACES ========================

interface DesignSystemElement {
  id: string;
  name: string;
  type: 'component' | 'componentSet' | 'textStyle' | 'colorStyle' | 'variable' | 'variableCollection';
  key?: string;
  description?: string;
  variantProperties?: { [property: string]: string } | null;
  variantPropertiesHash?: string;
  parentName?: string;
  modifiedAt?: number;
  updatedAt?: number;
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
  // Raw property data for detailed comparison
  fillsData?: string;
  strokesData?: string;
  cornerRadiusData?: string;
  sizeData?: string;
  effectsData?: string;
  typographyData?: string;
}

/**
 * Detailed property change information
 */
interface PropertyChangeInfo {
  property: string;
  displayName: string;
  oldValue: string;
  newValue: string;
  changeType: 'added' | 'removed' | 'modified';
}

/**
 * Enhanced element with detailed changes
 */
interface DetailedModifiedElement extends DesignSystemElement {
  changes: PropertyChangeInfo[];
  changesSummary: string;
}

interface TrackingData {
  timestamp: number;
  elements: DesignSystemElement[];
}

interface Changes {
  added: DesignSystemElement[];
  modified: DetailedModifiedElement[];
  removed: DesignSystemElement[];
  comment?: string;
}

interface PluginMessage {
  type: string;
  [key: string]: unknown;
}

// ======================== CONSTANTS ========================

const PLUGIN_NAMESPACE = 'changelog_tracker';
const TRACKING_DATA_KEY = 'trackingData';
const CHUNK_SIZE_LIMIT = 90000;
const LOGIFY_PAGE_NAME = "🖹 Logify";
const CHANGELOG_CONTAINER_NAME = "Changelog Container";
const ENTRY_NAME_PREFIX = "Logify Entry";

// ======================== UTILITY FUNCTIONS ========================

/**
 * Simple hash function (djb2 algorithm)
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
 * Generic hash function for objects
 */
function hashObject(obj: unknown): string {
  if (!obj) return '';
  return simpleHash(JSON.stringify(obj));
}

// ======================== VALIDATION FUNCTIONS ========================

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

// ======================== DATA COMPRESSION ========================

/**
 * Compress data for storage with shorter property names
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
    instanceOverridesHash: 'io', exposedPropertiesHash: 'ep'
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
 * Decompress data from storage
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
    io: 'instanceOverridesHash', ep: 'exposedPropertiesHash'
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

// ======================== STORAGE FUNCTIONS ========================

/**
 * Get stored tracking data with chunked support
 */
function getStoredTrackingData(): TrackingData | null {
  try {
    const metadataStr = figma.root.getSharedPluginData(PLUGIN_NAMESPACE, TRACKING_DATA_KEY + '_meta');
    
    if (!metadataStr || metadataStr.trim() === '') {
      return null;
    }
    
    const metadata = JSON.parse(metadataStr);
    let reconstructedDataStr = '';
    
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
 * Store tracking data with chunked support
 */
function setStoredTrackingData(data: TrackingData): void {
  try {
    clearStoredTrackingData();
    
    const compressedData = compressDataForStorage(data);
    const dataStr = JSON.stringify(compressedData);
    
    if (dataStr.length <= CHUNK_SIZE_LIMIT) {
      figma.root.setSharedPluginData(PLUGIN_NAMESPACE, TRACKING_DATA_KEY + '_chunk_0', dataStr);
      figma.root.setSharedPluginData(PLUGIN_NAMESPACE, TRACKING_DATA_KEY + '_meta', 
        JSON.stringify({ chunkCount: 1 }));
    } else {
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
 * Clear stored tracking data
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

// ======================== SERIALIZATION FUNCTIONS ========================

/**
 * Serialize paint properties
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
 * Serialize stroke properties
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
 * Serialize effect properties
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
 * Serialize layout properties
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
 * Serialize geometry properties
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
 * Serialize typography properties
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
 * Serialize component properties
 */
function serializeComponentProperties(node: ComponentNode | ComponentSetNode): string {
  const componentData = {
    description: node.description,
    documentationLinks: node.documentationLinks,
    remote: node.remote,
    key: node.key,
    ...(node.type === 'COMPONENT' && {
      variantProperties: (node as ComponentNode).variantProperties,
    }),
  };
  
  return hashObject(componentData);
}

/**
 * Serialize instance properties
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
 * Serialize variable properties
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

// ======================== DETAILED COMPARISON FUNCTIONS ========================

/**
 * Convert RGB to HEX format
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Serialize fill data for detailed comparison
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
 * Serialize stroke data for detailed comparison
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
 * Serialize corner radius for detailed comparison
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
 * Serialize size data for detailed comparison
 */
function serializeSizeDataDetailed(node: SceneNode): string {
  return `${Math.round(node.width)}×${Math.round(node.height)}px`;
}

/**
 * Serialize effects for detailed comparison
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
 * Serialize typography data for detailed comparison
 */
function serializeTypographyDataDetailed(node: SceneNode): string {
  if (node.type !== 'TEXT') return 'None';
  
  const textNode = node as TextNode;
  const fontName = typeof textNode.fontName === 'object' ? textNode.fontName.family : 'Mixed';
  const fontSize = typeof textNode.fontSize === 'number' ? textNode.fontSize : 'Mixed';
  
  return `${fontName}, ${fontSize}px`;
}

/**
 * Compare property values and create detailed change description
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
 * Create a summary of changes for display
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
 * Calculate structure hash for a node
 */
function calculateStructureHash(node: SceneNode): string {
  const hasChildren = 'children' in node && node.children.length > 0;
  if (!hasChildren) return '';
  
  const childrenData = (node as BaseNode & ChildrenMixin).children.map((child: SceneNode) => ({
    id: child.id,
    name: child.name,
    type: child.type,
    visible: child.visible,
  }));
  
  return hashObject(childrenData);
}

/**
 * Serialize scene node properties with detailed data collection
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
 * Serialize base style properties
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

// ======================== COLLECTION FUNCTIONS ========================

/**
 * Collect all components from the document
 */
async function collectComponents(): Promise<DesignSystemElement[]> {
  const components: DesignSystemElement[] = [];
  
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

/**
 * Collect all component sets from the document
 */
async function collectComponentSets(): Promise<DesignSystemElement[]> {
  const componentSets: DesignSystemElement[] = [];
  
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

/**
 * Collect all styles from the document
 */
async function collectStyles(): Promise<DesignSystemElement[]> {
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

/**
 * Collect all variables from the document
 */
async function collectVariables(): Promise<DesignSystemElement[]> {
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
 * Collect all design system elements
 */
async function collectDesignSystemElements(): Promise<DesignSystemElement[]> {
  const elements: DesignSystemElement[] = [];
  
  // Load all pages first (required by Figma API for findAllWithCriteria)
  await figma.loadAllPagesAsync();
  
  // Collect all element types
  const [components, componentSets, styles, variables] = await Promise.all([
    collectComponents(),
    collectComponentSets(),
    collectStyles(),
    collectVariables()
  ]);
  
  elements.push(...components, ...componentSets, ...styles, ...variables);
  
  return elements;
}

// ======================== COMPARISON FUNCTIONS ========================

/**
 * Compare two arrays of elements and return changes with detailed analysis
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
  
  return changes;
}

/**
 * Check if an element has changed by comparing hashes
 */
function hasElementChanged(previous: DesignSystemElement, current: DesignSystemElement): boolean {
  const hashFields = [
    'fillsHash', 'strokesHash', 'effectsHash', 'propertiesHash',
    'componentPropertiesHash', 'structureHash', 'layoutHash',
    'geometryHash', 'appearanceHash', 'borderHash', 'typographyHash',
    'variableUsageHash', 'variableDefinitionHash', 'interactionHash',
    'instanceOverridesHash', 'exposedPropertiesHash', 'variantPropertiesHash'
  ];
  
  return hashFields.some(field => previous[field as keyof DesignSystemElement] !== current[field as keyof DesignSystemElement]) ||
         previous.name !== current.name ||
         previous.description !== current.description;
}

// ======================== MAIN PLUGIN FUNCTIONS ========================

/**
 * Initialize plugin
 */
function initializePlugin(): void {
  figma.showUI(__html__, { width: 400, height: 600 });
  
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
 * Initialize tracking
 */
async function initializeTracking(): Promise<void> {
  try {
    const currentElements = await collectDesignSystemElements(); 
    const storedData = getStoredTrackingData();
    
    if (!storedData) {
      const initialData: TrackingData = {
        timestamp: Date.now(),
        elements: currentElements
      };
      setStoredTrackingData(initialData);
      
      figma.ui.postMessage({
        type: 'initialized',
        count: currentElements.length
      });
    } else {
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
    }
  } catch (error) {
    console.error('Error initializing tracking:', error);
    throw error;
  }
}

/**
 * Update tracking data
 */
async function updateTrackingData(notifyUI: boolean = true): Promise<void> {
  try {
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
  } catch (error) {
    console.error('Error updating tracking data:', error);
    throw error;
  }
}

/**
 * Scan and compare for changes
 */
async function scanAndCompare(): Promise<void> {
  try {
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
  } catch (error) {
    console.error('Error scanning for changes:', error);
    throw error;
  }
}

/**
 * Format element for display with detailed changes
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
  
  if (element.parentName) {
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

/**
 * Add changes to Figma page
 */
async function addToFigma(changes: Changes): Promise<void> {
  try {
    // Load required fonts
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    await figma.loadFontAsync({ family: "Inter", style: "Medium" });
    await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });
    
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
    
    // Add comment if provided
    if (changes.comment) {
      const commentText = figma.createText();
      commentText.characters = `💬 ${changes.comment}`;
      commentText.fontSize = 13;
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
    
  } catch (error) {
    console.error('Error adding to Figma:', error);
    figma.ui.postMessage({ 
      type: 'error',
      message: 'Failed to add to Figma: ' + (error instanceof Error ? error.message : String(error))
    });
  }
}

// ======================== MESSAGE HANDLER ========================

/**
 * Handle UI messages
 */
figma.ui.onmessage = async (msg: PluginMessage) => {
  try {
    switch (msg.type) {
      case 'initialize':
        await initializeTracking();
        break;
        
      case 'refresh':
        await scanAndCompare();
        break;
        
      case 'addToFigma': {
        if (msg.changes && validateChanges(msg.changes)) {
          // Validate comment if provided
          const comment = typeof msg.comment === 'string' ? msg.comment.trim() : '';
          if (comment && comment.length > 500) {
            figma.ui.postMessage({
              type: 'error',
              message: 'Comment too long (maximum 500 characters)'
            });
            break;
          }
          
          // Add comment to changes object
          const changesWithComment = {
            ...msg.changes,
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
        
      default:
        console.warn('Unknown message type:', msg.type);
        figma.ui.postMessage({
          type: 'error',
          message: 'Unknown command: ' + msg.type
        });
    }
  } catch (error) {
    console.error('Error in message handler:', error);
    figma.ui.postMessage({
      type: 'error',
      message: 'Error: ' + (error instanceof Error ? error.message : String(error))
    });
    figma.notify('Error occurred', { error: true });
  }
};

// ======================== PLUGIN INITIALIZATION ========================

initializePlugin();
