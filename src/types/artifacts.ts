/**
 * Artifact Registry Types
 *
 * Artifacts are uniquely identifiable, persistent architectural elements.
 * Each artifact has a canonical ID derived from its source (git repo, file path, etc.)
 * enabling reuse across diagrams, analyses, and documentation.
 */

/**
 * Artifact categories aligned with C4 and ArchiMate
 */
export type ArtifactCategory =
  | 'person'           // C4 Person / ArchiMate Business Actor
  | 'system'           // C4 Software System
  | 'container'        // C4 Container
  | 'component'        // C4 Component
  | 'code'             // C4 Code Element
  | 'archimate'        // ArchiMate Element (any layer)
  | 'relationship'     // Relationship between artifacts
  | 'external';        // External system/service

/**
 * Source information for artifact traceability
 */
export interface ArtifactSource {
  /** Git repository URL or name */
  repository?: string;
  /** Git branch */
  branch?: string;
  /** Git commit SHA at time of creation/update */
  commitSha?: string;
  /** Relative file path within repository */
  filePath?: string;
  /** Line number range [start, end] */
  lineRange?: [number, number];
  /** Package/module name */
  packageName?: string;
  /** Namespace or scope */
  namespace?: string;
}

/**
 * Unique artifact identifier components
 */
export interface ArtifactIdentifier {
  /** Organization or owner (e.g., github org, company) */
  org: string;
  /** Repository or project name */
  repo: string;
  /** Artifact category */
  category: ArtifactCategory;
  /** Canonical name (e.g., class name, service name) */
  name: string;
  /** Optional qualifier for disambiguation (e.g., module path) */
  qualifier?: string;
}

/**
 * Base artifact interface - all architectural elements extend this
 */
export interface Artifact {
  /** Globally unique artifact ID (URN format) */
  urn: string;

  /** Parsed identifier components */
  identifier: ArtifactIdentifier;

  /** Human-readable display name */
  displayName: string;

  /** Description of the artifact */
  description?: string;

  /** Artifact category */
  category: ArtifactCategory;

  /** Source code/config location */
  source?: ArtifactSource;

  /** Technology/implementation details */
  technology?: string;

  /** Custom tags for filtering/grouping */
  tags?: string[];

  /** Custom properties */
  properties?: Record<string, string | number | boolean>;

  /** Creation timestamp */
  createdAt: string;

  /** Last update timestamp */
  updatedAt: string;

  /** Version for optimistic concurrency */
  version: number;
}

/**
 * Artifact relationship
 */
export interface ArtifactRelationship {
  /** Unique relationship ID */
  urn: string;

  /** Source artifact URN */
  sourceUrn: string;

  /** Target artifact URN */
  targetUrn: string;

  /** Relationship type */
  type: RelationshipType;

  /** Relationship label/description */
  label?: string;

  /** Technology/protocol used */
  technology?: string;

  /** Direction hint for rendering */
  direction?: 'forward' | 'backward' | 'bidirectional';

  /** Source information */
  source?: ArtifactSource;

  /** Timestamps */
  createdAt: string;
  updatedAt: string;
}

/**
 * Relationship types (union of C4 and ArchiMate)
 */
export type RelationshipType =
  // Generic
  | 'uses'
  | 'depends_on'
  | 'calls'
  | 'contains'
  // C4 specific
  | 'interacts_with'
  | 'reads_from'
  | 'writes_to'
  // ArchiMate specific
  | 'composition'
  | 'aggregation'
  | 'assignment'
  | 'realization'
  | 'serving'
  | 'access'
  | 'influence'
  | 'triggering'
  | 'flow'
  | 'specialization'
  | 'association';

/**
 * Artifact registry - collection of artifacts for a project
 */
export interface ArtifactRegistry {
  /** Registry ID (typically repo-based) */
  id: string;

  /** Registry display name */
  name: string;

  /** Git repository URL */
  repository?: string;

  /** All registered artifacts by URN */
  artifacts: Map<string, Artifact>;

  /** All relationships by URN */
  relationships: Map<string, ArtifactRelationship>;

  /** Schema version for migrations */
  schemaVersion: string;

  /** Timestamps */
  createdAt: string;
  updatedAt: string;
}

/**
 * Serializable version of registry for persistence
 */
export interface ArtifactRegistryData {
  id: string;
  name: string;
  repository?: string;
  artifacts: Record<string, Artifact>;
  relationships: Record<string, ArtifactRelationship>;
  schemaVersion: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Template for creating new artifacts
 */
export interface ArtifactTemplate {
  /** Template ID */
  id: string;

  /** Category this template creates */
  category: ArtifactCategory;

  /** Default display name pattern (supports {name}, {path} tokens) */
  displayNamePattern: string;

  /** Default description pattern */
  descriptionPattern?: string;

  /** Required fields */
  requiredFields: string[];

  /** Default property values */
  defaultProperties?: Record<string, string | number | boolean>;

  /** Default tags */
  defaultTags?: string[];
}

/**
 * Artifact query for searching/filtering
 */
export interface ArtifactQuery {
  /** Filter by category */
  category?: ArtifactCategory | ArtifactCategory[];

  /** Filter by tags (AND) */
  tags?: string[];

  /** Filter by tags (OR) */
  anyTags?: string[];

  /** Search in name/description */
  search?: string;

  /** Filter by source repository */
  repository?: string;

  /** Filter by source file path pattern */
  filePathPattern?: string;

  /** Filter by technology */
  technology?: string;

  /** Include relationships */
  includeRelationships?: boolean;

  /** Limit results */
  limit?: number;
}

/**
 * Result of artifact resolution
 */
export interface ArtifactResolution {
  /** Resolved artifact (or null if not found) */
  artifact: Artifact | null;

  /** Whether this is a new artifact */
  isNew: boolean;

  /** Related artifacts */
  related?: Artifact[];

  /** Inbound relationships */
  inboundRelationships?: ArtifactRelationship[];

  /** Outbound relationships */
  outboundRelationships?: ArtifactRelationship[];
}

/**
 * Name index entry - maps URN to file path for O(1) lookup
 */
export interface NameIndexEntry {
  /** File path relative to .architecture/ */
  filePath: string;
  /** Artifact category for quick filtering */
  category: ArtifactCategory;
  /** Display name for quick access without loading file */
  displayName: string;
  /** Last updated timestamp */
  updatedAt: string;
}

/**
 * Name index - maps URN to file metadata
 */
export interface NameIndex {
  /** Version for index migrations */
  version: string;
  /** URN to entry mapping */
  entries: Record<string, NameIndexEntry>;
  /** Last rebuild timestamp */
  lastRebuilt: string;
}

/**
 * Relationship index entry
 */
export interface RelationshipIndexEntry {
  /** Relationship URN */
  urn: string;
  /** File path relative to .architecture/ */
  filePath: string;
  /** Source artifact URN */
  sourceUrn: string;
  /** Target artifact URN */
  targetUrn: string;
  /** Relationship type */
  type: RelationshipType;
  /** Last updated timestamp */
  updatedAt: string;
}

/**
 * Relationship index - enables O(1) lookups by source/target
 */
export interface RelationshipIndex {
  /** Version for index migrations */
  version: string;
  /** Relationship URN to entry mapping */
  entries: Record<string, RelationshipIndexEntry>;
  /** Index by source URN for outbound lookups */
  bySource: Record<string, string[]>;
  /** Index by target URN for inbound lookups */
  byTarget: Record<string, string[]>;
  /** Last rebuild timestamp */
  lastRebuilt: string;
}

/**
 * Registry metadata - lightweight header stored in registry.json
 */
export interface RegistryMetadata {
  /** Registry ID (typically repo-based) */
  id: string;
  /** Registry display name */
  name: string;
  /** Git repository URL */
  repository?: string;
  /** Schema version for migrations */
  schemaVersion: string;
  /** Storage format version */
  storageVersion: string;
  /** Timestamps */
  createdAt: string;
  updatedAt: string;
  /** Total artifact count (for quick stats) */
  artifactCount: number;
  /** Total relationship count (for quick stats) */
  relationshipCount: number;
}

/**
 * Artifact markdown frontmatter structure
 */
export interface ArtifactFrontmatter {
  urn: string;
  identifier: ArtifactIdentifier;
  displayName: string;
  category: ArtifactCategory;
  technology?: string;
  tags?: string[];
  source?: ArtifactSource;
  properties?: Record<string, string | number | boolean>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Relationship markdown frontmatter structure
 */
export interface RelationshipFrontmatter {
  urn: string;
  sourceUrn: string;
  targetUrn: string;
  type: RelationshipType;
  label?: string;
  technology?: string;
  direction?: 'forward' | 'backward' | 'bidirectional';
  source?: ArtifactSource;
  createdAt: string;
  updatedAt: string;
}
