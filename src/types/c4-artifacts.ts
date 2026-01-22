/**
 * C4 Model Types with Artifact References
 *
 * These types extend the base C4 model to use persistent artifacts
 * from the registry instead of inline definitions.
 */

import type { Artifact, ArtifactRelationship } from './artifacts.js';
import type { C4Level } from './c4.js';

/**
 * C4 Person backed by artifact
 */
export interface C4PersonArtifact {
  /** Reference to artifact URN */
  artifactUrn: string;

  /** Resolved artifact (populated at runtime) */
  artifact?: Artifact;

  /** Whether this is an external person */
  external?: boolean;
}

/**
 * C4 Software System backed by artifact
 */
export interface C4SystemArtifact {
  /** Reference to artifact URN */
  artifactUrn: string;

  /** Resolved artifact (populated at runtime) */
  artifact?: Artifact;

  /** Whether this is an external system */
  external?: boolean;

  /** Container URNs within this system */
  containerUrns?: string[];

  /** Resolved containers (populated at runtime) */
  containers?: C4ContainerArtifact[];
}

/**
 * C4 Container backed by artifact
 */
export interface C4ContainerArtifact {
  /** Reference to artifact URN */
  artifactUrn: string;

  /** Resolved artifact (populated at runtime) */
  artifact?: Artifact;

  /** Parent system URN */
  systemUrn?: string;

  /** Component URNs within this container */
  componentUrns?: string[];

  /** Resolved components (populated at runtime) */
  components?: C4ComponentArtifact[];
}

/**
 * C4 Component backed by artifact
 */
export interface C4ComponentArtifact {
  /** Reference to artifact URN */
  artifactUrn: string;

  /** Resolved artifact (populated at runtime) */
  artifact?: Artifact;

  /** Parent container URN */
  containerUrn?: string;

  /** Code element URNs within this component */
  codeUrns?: string[];

  /** Resolved code elements (populated at runtime) */
  codeElements?: C4CodeArtifact[];
}

/**
 * C4 Code Element backed by artifact
 */
export interface C4CodeArtifact {
  /** Reference to artifact URN */
  artifactUrn: string;

  /** Resolved artifact (populated at runtime) */
  artifact?: Artifact;

  /** Parent component URN */
  componentUrn?: string;

  /** Code type */
  codeType?: 'class' | 'interface' | 'function' | 'module' | 'package';
}

/**
 * C4 Relationship backed by artifact relationship
 */
export interface C4RelationshipArtifact {
  /** Reference to relationship URN */
  relationshipUrn: string;

  /** Resolved relationship (populated at runtime) */
  relationship?: ArtifactRelationship;
}

/**
 * C4 Model using artifact references
 */
export interface C4ModelArtifact {
  /** Model title */
  title: string;

  /** Model description */
  description?: string;

  /** Repository this model is derived from */
  repository?: string;

  /** People/actors */
  people: C4PersonArtifact[];

  /** Software systems */
  systems: C4SystemArtifact[];

  /** Relationships between elements */
  relationships: C4RelationshipArtifact[];

  /** Model metadata */
  metadata?: {
    createdAt: string;
    updatedAt: string;
    version: string;
    sourceCommit?: string;
  };
}

/**
 * C4 View Definition
 * Defines which artifacts to include in a specific diagram
 */
export interface C4ViewDefinition {
  /** View identifier */
  id: string;

  /** View name */
  name: string;

  /** View description */
  description?: string;

  /** C4 level for this view */
  level: C4Level;

  /** Scope artifact URN (the element in focus) */
  scopeUrn?: string;

  /** Artifact URNs to include in the view */
  includedUrns: string[];

  /** Relationship URNs to include */
  includedRelationshipUrns: string[];

  /** Whether to show external elements */
  showExternal?: boolean;

  /** Diagram direction */
  direction?: 'TB' | 'LR' | 'BT' | 'RL';
}

/**
 * Helper to check if an artifact is a C4 element
 */
export function isC4Artifact(artifact: Artifact): boolean {
  return artifact.tags?.some(t => t === 'c4') ?? false;
}

/**
 * Get C4 level from artifact category
 */
export function getC4LevelFromCategory(category: string): C4Level | null {
  const mapping: Record<string, C4Level> = {
    person: 'context',
    system: 'context',
    external: 'context',
    container: 'container',
    component: 'component',
    code: 'code'
  };
  return mapping[category] || null;
}

/**
 * Build hierarchical C4 model from flat artifact list
 */
export function buildC4Hierarchy(
  artifacts: Artifact[],
  relationships: ArtifactRelationship[]
): C4ModelArtifact {
  const people: C4PersonArtifact[] = [];
  const systems: C4SystemArtifact[] = [];
  const modelRelationships: C4RelationshipArtifact[] = [];

  // Index artifacts by URN
  const artifactMap = new Map<string, Artifact>();
  for (const a of artifacts) {
    artifactMap.set(a.urn, a);
  }

  // Separate by category
  const containersBySystem = new Map<string, C4ContainerArtifact[]>();
  const componentsByContainer = new Map<string, C4ComponentArtifact[]>();
  const codeByComponent = new Map<string, C4CodeArtifact[]>();

  for (const artifact of artifacts) {
    switch (artifact.category) {
      case 'person':
        people.push({
          artifactUrn: artifact.urn,
          artifact,
          external: artifact.properties?.external === true
        });
        break;

      case 'system':
      case 'external':
        systems.push({
          artifactUrn: artifact.urn,
          artifact,
          external: artifact.category === 'external' || artifact.properties?.external === true,
          containerUrns: [],
          containers: []
        });
        break;

      case 'container': {
        const parentUrn = artifact.properties?.parentUrn as string;
        const container: C4ContainerArtifact = {
          artifactUrn: artifact.urn,
          artifact,
          systemUrn: parentUrn,
          componentUrns: [],
          components: []
        };
        const list = containersBySystem.get(parentUrn) || [];
        list.push(container);
        containersBySystem.set(parentUrn, list);
        break;
      }

      case 'component': {
        const parentUrn = artifact.properties?.parentUrn as string;
        const component: C4ComponentArtifact = {
          artifactUrn: artifact.urn,
          artifact,
          containerUrn: parentUrn,
          codeUrns: [],
          codeElements: []
        };
        const list = componentsByContainer.get(parentUrn) || [];
        list.push(component);
        componentsByContainer.set(parentUrn, list);
        break;
      }

      case 'code': {
        const parentUrn = artifact.properties?.parentUrn as string;
        const codeType = (artifact.properties?.codeType as C4CodeArtifact['codeType']) || 'class';
        const code: C4CodeArtifact = {
          artifactUrn: artifact.urn,
          artifact,
          componentUrn: parentUrn,
          codeType
        };
        const list = codeByComponent.get(parentUrn) || [];
        list.push(code);
        codeByComponent.set(parentUrn, list);
        break;
      }
    }
  }

  // Link containers to systems
  for (const system of systems) {
    const containers = containersBySystem.get(system.artifactUrn) || [];
    system.containers = containers;
    system.containerUrns = containers.map(c => c.artifactUrn);

    // Link components to containers
    for (const container of containers) {
      const components = componentsByContainer.get(container.artifactUrn) || [];
      container.components = components;
      container.componentUrns = components.map(c => c.artifactUrn);

      // Link code to components
      for (const component of components) {
        const codeElements = codeByComponent.get(component.artifactUrn) || [];
        component.codeElements = codeElements;
        component.codeUrns = codeElements.map(c => c.artifactUrn);
      }
    }
  }

  // Build relationships
  for (const rel of relationships) {
    modelRelationships.push({
      relationshipUrn: rel.urn,
      relationship: rel
    });
  }

  return {
    title: 'C4 Model',
    people,
    systems,
    relationships: modelRelationships,
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: '1.0'
    }
  };
}
