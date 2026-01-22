/**
 * ArchiMate Diagram Generator using Mermaid
 * Generates ArchiMate diagrams in Mermaid syntax
 */

import type {
  ArchiMateModel,
  ArchiMateElement,
  ArchiMateRelationship,
  ArchiMateDiagramOptions,
  ArchiMateLayer,
  ArchiMateViewpoint,
  ArchiMateElementType
} from '../types/archimate.js';

// Layer colors based on ArchiMate specification
const LAYER_COLORS: Record<ArchiMateLayer, { fill: string; stroke: string; text: string }> = {
  strategy: { fill: '#F5DEAA', stroke: '#C9A64D', text: '#000' },
  business: { fill: '#FFFFB5', stroke: '#C9C96D', text: '#000' },
  application: { fill: '#B5FFFF', stroke: '#6DC9C9', text: '#000' },
  technology: { fill: '#C9E7B7', stroke: '#8DB87D', text: '#000' },
  physical: { fill: '#C9E7B7', stroke: '#8DB87D', text: '#000' },
  implementation: { fill: '#FFB5D8', stroke: '#C96DA0', text: '#000' }
};

// Element icons/shapes
const ELEMENT_ICONS: Partial<Record<ArchiMateElementType, string>> = {
  businessActor: '👤',
  businessRole: '🎭',
  businessProcess: '⚙️',
  businessService: '📋',
  businessObject: '📄',
  applicationComponent: '📦',
  applicationService: '🔌',
  applicationInterface: '🔗',
  dataObject: '💾',
  node: '🖥️',
  device: '💻',
  systemSoftware: '⚡',
  artifact: '📁',
  technologyService: '🌐',
  stakeholder: '👥',
  goal: '🎯',
  requirement: '📋',
  constraint: '⛔'
};

export class ArchiMateMermaidGenerator {
  /**
   * Generate an ArchiMate diagram in Mermaid syntax
   */
  generate(model: ArchiMateModel, options: ArchiMateDiagramOptions): string {
    const viewpoint = options.viewpoint || 'layered';
    const direction = options.direction || 'TB';

    const lines: string[] = [
      `%% ArchiMate Diagram: ${model.name}`,
      `%% Viewpoint: ${viewpoint}`,
      `%% ${model.description || ''}`,
      '',
      `graph ${direction}`,
      ''
    ];

    // Add layer-specific styles
    lines.push(...this.getArchiMateStyles());
    lines.push('');

    // Filter elements by viewpoint/layers
    const filteredElements = this.filterElementsByViewpoint(model.elements, viewpoint, options.layers);

    // Group by layer if requested
    if (options.groupByLayer !== false) {
      lines.push(...this.generateLayeredDiagram(filteredElements, model.relationships, options));
    } else {
      lines.push(...this.generateFlatDiagram(filteredElements, model.relationships, options));
    }

    return lines.join('\n');
  }

  /**
   * Generate diagram with elements grouped by layer
   */
  private generateLayeredDiagram(
    elements: ArchiMateElement[],
    relationships: ArchiMateRelationship[],
    options: ArchiMateDiagramOptions
  ): string[] {
    const lines: string[] = [];

    // Group elements by layer
    const layerGroups = new Map<ArchiMateLayer, ArchiMateElement[]>();
    for (const elem of elements) {
      const group = layerGroups.get(elem.layer) || [];
      group.push(elem);
      layerGroups.set(elem.layer, group);
    }

    // Layer order for display
    const layerOrder: ArchiMateLayer[] = ['strategy', 'business', 'application', 'technology', 'physical', 'implementation'];

    for (const layer of layerOrder) {
      const layerElements = layerGroups.get(layer);
      if (!layerElements || layerElements.length === 0) continue;

      lines.push(`    subgraph ${layer}_layer["${this.formatLayerName(layer)} Layer"]`);
      lines.push(`        direction LR`);

      for (const elem of layerElements) {
        lines.push(`        ${this.formatElement(elem)}`);
      }

      lines.push(`    end`);
      lines.push('');
    }

    // Add relationships
    if (options.showRelationships !== false) {
      lines.push('');
      const elementIds = new Set(elements.map(e => e.id));
      for (const rel of relationships) {
        if (elementIds.has(rel.sourceId) && elementIds.has(rel.targetId)) {
          lines.push(`    ${this.formatRelationship(rel)}`);
        }
      }
    }

    return lines;
  }

  /**
   * Generate flat diagram without layer grouping
   */
  private generateFlatDiagram(
    elements: ArchiMateElement[],
    relationships: ArchiMateRelationship[],
    options: ArchiMateDiagramOptions
  ): string[] {
    const lines: string[] = [];

    // Add elements
    for (const elem of elements) {
      lines.push(`    ${this.formatElement(elem)}`);
    }

    lines.push('');

    // Add relationships
    if (options.showRelationships !== false) {
      const elementIds = new Set(elements.map(e => e.id));
      for (const rel of relationships) {
        if (elementIds.has(rel.sourceId) && elementIds.has(rel.targetId)) {
          lines.push(`    ${this.formatRelationship(rel)}`);
        }
      }
    }

    return lines;
  }

  /**
   * Format an element for Mermaid
   */
  private formatElement(elem: ArchiMateElement): string {
    const icon = ELEMENT_ICONS[elem.type] || '◆';
    const styleClass = `:::${elem.layer}`;
    const description = elem.description ? `<br/><i>${elem.description}</i>` : '';
    return `${elem.id}["${icon} ${elem.name}${description}"]${styleClass}`;
  }

  /**
   * Format a relationship for Mermaid
   */
  private formatRelationship(rel: ArchiMateRelationship): string {
    const arrow = this.getRelationshipArrow(rel.type);
    const label = rel.name ? `|"${rel.name}"|` : '';
    return `${rel.sourceId} ${arrow}${label} ${rel.targetId}`;
  }

  /**
   * Get Mermaid arrow style for relationship type
   */
  private getRelationshipArrow(type: ArchiMateRelationship['type']): string {
    switch (type) {
      case 'composition':
        return '--*';
      case 'aggregation':
        return '--o';
      case 'assignment':
        return '==>';
      case 'realization':
        return '-..->';
      case 'serving':
        return '-->';
      case 'access':
        return '--->';
      case 'influence':
        return '-.->';
      case 'triggering':
        return '==>';
      case 'flow':
        return '~~~>';
      case 'specialization':
        return '--|>';
      case 'association':
      default:
        return '---';
    }
  }

  /**
   * Filter elements based on viewpoint
   */
  private filterElementsByViewpoint(
    elements: ArchiMateElement[],
    viewpoint: ArchiMateViewpoint,
    layers?: ArchiMateLayer[]
  ): ArchiMateElement[] {
    // If specific layers are provided, filter by them
    if (layers && layers.length > 0) {
      return elements.filter(e => layers.includes(e.layer));
    }

    // Filter based on viewpoint
    switch (viewpoint) {
      case 'organization':
        return elements.filter(e => e.layer === 'business' && ['businessActor', 'businessRole', 'businessCollaboration'].includes(e.type));
      case 'businessProcessCooperation':
        return elements.filter(e => e.layer === 'business');
      case 'application':
        return elements.filter(e => e.layer === 'application');
      case 'applicationCooperation':
        return elements.filter(e => e.layer === 'application');
      case 'technology':
      case 'technologyUsage':
        return elements.filter(e => e.layer === 'technology' || e.layer === 'physical');
      case 'motivation':
        return elements.filter(e => ['stakeholder', 'driver', 'assessment', 'goal', 'outcome', 'principle', 'requirement', 'constraint'].includes(e.type));
      case 'layered':
      default:
        return elements;
    }
  }

  /**
   * Format layer name for display
   */
  private formatLayerName(layer: ArchiMateLayer): string {
    return layer.charAt(0).toUpperCase() + layer.slice(1);
  }

  /**
   * Get ArchiMate styling classes for Mermaid
   */
  private getArchiMateStyles(): string[] {
    const styles: string[] = [];
    for (const [layer, colors] of Object.entries(LAYER_COLORS)) {
      styles.push(`    classDef ${layer} fill:${colors.fill},stroke:${colors.stroke},color:${colors.text}`);
    }
    return styles;
  }
}

/**
 * Generate standard ArchiMate views for a model
 */
export function generateStandardArchiMateViews(model: ArchiMateModel): Map<ArchiMateViewpoint, string> {
  const generator = new ArchiMateMermaidGenerator();
  const diagrams = new Map<ArchiMateViewpoint, string>();

  // Layered view (full model)
  diagrams.set('layered', generator.generate(model, { viewpoint: 'layered' }));

  // Check which layers have elements and generate appropriate views
  const hasLayer = (layer: ArchiMateLayer) => model.elements.some(e => e.layer === layer);

  if (hasLayer('business')) {
    diagrams.set('businessProcessCooperation', generator.generate(model, { viewpoint: 'businessProcessCooperation' }));
  }

  if (hasLayer('application')) {
    diagrams.set('application', generator.generate(model, { viewpoint: 'application' }));
  }

  if (hasLayer('technology')) {
    diagrams.set('technology', generator.generate(model, { viewpoint: 'technology' }));
  }

  return diagrams;
}
