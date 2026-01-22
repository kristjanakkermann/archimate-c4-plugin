/**
 * ArchiMate Types with Artifact References
 *
 * These types extend the base ArchiMate model to use persistent artifacts
 * from the registry instead of inline definitions.
 */

import type { Artifact, ArtifactRelationship } from './artifacts.js';
import type {
  ArchiMateLayer,
  ArchiMateElementType,
  ArchiMateRelationType,
  ArchiMateViewpoint
} from './archimate.js';

/**
 * ArchiMate Element backed by artifact
 */
export interface ArchiMateElementArtifact {
  /** Reference to artifact URN */
  artifactUrn: string;

  /** Resolved artifact (populated at runtime) */
  artifact?: Artifact;

  /** ArchiMate layer */
  layer: ArchiMateLayer;

  /** ArchiMate element type */
  elementType: ArchiMateElementType;
}

/**
 * ArchiMate Relationship backed by artifact relationship
 */
export interface ArchiMateRelationshipArtifact {
  /** Reference to relationship URN */
  relationshipUrn: string;

  /** Resolved relationship (populated at runtime) */
  relationship?: ArtifactRelationship;

  /** ArchiMate relationship type */
  archimateType: ArchiMateRelationType;

  /** Access type for access relationships */
  accessType?: 'read' | 'write' | 'readWrite';

  /** Influence strength for influence relationships */
  influenceStrength?: '+' | '++' | '-' | '--';
}

/**
 * ArchiMate View using artifact references
 */
export interface ArchiMateViewArtifact {
  /** View identifier */
  id: string;

  /** View name */
  name: string;

  /** View description */
  description?: string;

  /** ArchiMate viewpoint */
  viewpoint: ArchiMateViewpoint;

  /** Element artifact URNs included in this view */
  elementUrns: string[];

  /** Relationship URNs included in this view */
  relationshipUrns: string[];

  /** Resolved elements (populated at runtime) */
  elements?: ArchiMateElementArtifact[];

  /** Resolved relationships (populated at runtime) */
  relationships?: ArchiMateRelationshipArtifact[];
}

/**
 * ArchiMate Model using artifact references
 */
export interface ArchiMateModelArtifact {
  /** Model name */
  name: string;

  /** Model description */
  description?: string;

  /** Repository this model is derived from */
  repository?: string;

  /** All elements (by URN for quick lookup) */
  elements: Map<string, ArchiMateElementArtifact>;

  /** All relationships (by URN) */
  relationships: Map<string, ArchiMateRelationshipArtifact>;

  /** Defined views */
  views: ArchiMateViewArtifact[];

  /** Model metadata */
  metadata?: {
    version?: string;
    created?: string;
    modified?: string;
    author?: string;
    sourceCommit?: string;
  };
}

/**
 * Serializable version of ArchiMate model
 */
export interface ArchiMateModelArtifactData {
  name: string;
  description?: string;
  repository?: string;
  elements: Record<string, ArchiMateElementArtifact>;
  relationships: Record<string, ArchiMateRelationshipArtifact>;
  views: ArchiMateViewArtifact[];
  metadata?: ArchiMateModelArtifact['metadata'];
}

/**
 * Layer configuration for grouping
 */
export interface ArchiMateLayerConfig {
  layer: ArchiMateLayer;
  displayName: string;
  color: string;
  elementUrns: string[];
}

/**
 * Helper to check if an artifact is an ArchiMate element
 */
export function isArchiMateArtifact(artifact: Artifact): boolean {
  return artifact.tags?.some(t => t === 'archimate') ?? false;
}

/**
 * Get ArchiMate layer from artifact properties
 */
export function getArchiMateLayer(artifact: Artifact): ArchiMateLayer | null {
  const layer = artifact.properties?.layer;
  if (typeof layer === 'string') {
    return layer as ArchiMateLayer;
  }

  // Infer from tags
  const layerTags: ArchiMateLayer[] = ['strategy', 'business', 'application', 'technology', 'physical', 'implementation'];
  for (const tag of artifact.tags || []) {
    if (layerTags.includes(tag as ArchiMateLayer)) {
      return tag as ArchiMateLayer;
    }
  }

  return null;
}

/**
 * Get ArchiMate element type from artifact properties
 */
export function getArchiMateElementType(artifact: Artifact): ArchiMateElementType | null {
  const elementType = artifact.properties?.elementType;
  if (typeof elementType === 'string') {
    return elementType as ArchiMateElementType;
  }
  return null;
}

/**
 * Map generic relationship type to ArchiMate type
 */
export function mapToArchiMateRelationType(type: string): ArchiMateRelationType {
  const mapping: Record<string, ArchiMateRelationType> = {
    uses: 'serving',
    depends_on: 'serving',
    calls: 'triggering',
    contains: 'composition',
    interacts_with: 'association',
    reads_from: 'access',
    writes_to: 'access',
    implements: 'realization',
    extends: 'specialization'
  };

  return (mapping[type] as ArchiMateRelationType) || (type as ArchiMateRelationType);
}

/**
 * Build ArchiMate model from artifacts
 */
export function buildArchiMateModel(
  artifacts: Artifact[],
  relationships: ArtifactRelationship[]
): ArchiMateModelArtifact {
  const elements = new Map<string, ArchiMateElementArtifact>();
  const rels = new Map<string, ArchiMateRelationshipArtifact>();

  // Process artifacts that are ArchiMate elements
  for (const artifact of artifacts) {
    if (!isArchiMateArtifact(artifact)) continue;

    const layer = getArchiMateLayer(artifact);
    const elementType = getArchiMateElementType(artifact);

    if (!layer || !elementType) continue;

    elements.set(artifact.urn, {
      artifactUrn: artifact.urn,
      artifact,
      layer,
      elementType
    });
  }

  // Process relationships
  for (const rel of relationships) {
    // Only include relationships where both source and target are ArchiMate elements
    if (!elements.has(rel.sourceUrn) || !elements.has(rel.targetUrn)) {
      continue;
    }

    rels.set(rel.urn, {
      relationshipUrn: rel.urn,
      relationship: rel,
      archimateType: mapToArchiMateRelationType(rel.type)
    });
  }

  // Create default layered view
  const layeredView: ArchiMateViewArtifact = {
    id: 'layered-view',
    name: 'Layered View',
    description: 'Full architecture across all layers',
    viewpoint: 'layered',
    elementUrns: Array.from(elements.keys()),
    relationshipUrns: Array.from(rels.keys())
  };

  return {
    name: 'ArchiMate Model',
    elements,
    relationships: rels,
    views: [layeredView],
    metadata: {
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      version: '1.0'
    }
  };
}

/**
 * Group elements by layer
 */
export function groupByLayer(model: ArchiMateModelArtifact): ArchiMateLayerConfig[] {
  const layers: ArchiMateLayerConfig[] = [
    { layer: 'strategy', displayName: 'Strategy', color: '#F5DEAA', elementUrns: [] },
    { layer: 'business', displayName: 'Business', color: '#FFFFB5', elementUrns: [] },
    { layer: 'application', displayName: 'Application', color: '#B5FFFF', elementUrns: [] },
    { layer: 'technology', displayName: 'Technology', color: '#C9E7B7', elementUrns: [] },
    { layer: 'physical', displayName: 'Physical', color: '#C9E7B7', elementUrns: [] },
    { layer: 'implementation', displayName: 'Implementation', color: '#FFB5D8', elementUrns: [] }
  ];

  for (const [urn, element] of model.elements) {
    const layerConfig = layers.find(l => l.layer === element.layer);
    if (layerConfig) {
      layerConfig.elementUrns.push(urn);
    }
  }

  // Filter out empty layers
  return layers.filter(l => l.elementUrns.length > 0);
}

/**
 * Create a filtered view for a specific viewpoint
 */
export function createFilteredView(
  model: ArchiMateModelArtifact,
  viewpoint: ArchiMateViewpoint,
  viewId: string,
  viewName: string
): ArchiMateViewArtifact {
  const includedLayers = getLayersForViewpoint(viewpoint);
  const elementUrns: string[] = [];

  for (const [urn, element] of model.elements) {
    if (includedLayers.includes(element.layer)) {
      elementUrns.push(urn);
    }
  }

  // Include relationships where both source and target are included
  const elementUrnSet = new Set(elementUrns);
  const relationshipUrns: string[] = [];

  for (const [urn, rel] of model.relationships) {
    if (rel.relationship &&
        elementUrnSet.has(rel.relationship.sourceUrn) &&
        elementUrnSet.has(rel.relationship.targetUrn)) {
      relationshipUrns.push(urn);
    }
  }

  return {
    id: viewId,
    name: viewName,
    viewpoint,
    elementUrns,
    relationshipUrns
  };
}

/**
 * Get layers relevant to a viewpoint
 */
function getLayersForViewpoint(viewpoint: ArchiMateViewpoint): ArchiMateLayer[] {
  const viewpointLayers: Record<ArchiMateViewpoint, ArchiMateLayer[]> = {
    organization: ['business'],
    businessProcessCooperation: ['business'],
    product: ['business'],
    application: ['application'],
    applicationCooperation: ['application'],
    technologyUsage: ['application', 'technology'],
    technology: ['technology'],
    physicalEnvironment: ['physical'],
    layered: ['strategy', 'business', 'application', 'technology', 'physical', 'implementation'],
    implementation: ['implementation'],
    migration: ['implementation'],
    stakeholder: ['business'],
    goalRealization: ['business'],
    requirementsRealization: ['business', 'application'],
    motivation: ['business']
  };

  return viewpointLayers[viewpoint] || ['business', 'application', 'technology'];
}
