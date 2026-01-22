/**
 * Artifact Registry Implementation
 *
 * Manages persistent, uniquely-identified architectural artifacts.
 * Artifacts are identified by URNs derived from their source location.
 */

import type {
  Artifact,
  ArtifactCategory,
  ArtifactIdentifier,
  ArtifactQuery,
  ArtifactRegistry,
  ArtifactRegistryData,
  ArtifactRelationship,
  ArtifactResolution,
  ArtifactSource,
  RelationshipType
} from '../types/artifacts.js';

/** Current schema version */
export const SCHEMA_VERSION = '1.0.0';

/** URN prefix for all artifacts */
export const URN_PREFIX = 'urn:archimate-c4';

/**
 * Generate a unique URN for an artifact
 *
 * Format: urn:archimate-c4:{org}:{repo}:{category}:{qualifier?/}{name}
 *
 * Examples:
 * - urn:archimate-c4:acme:ecommerce:container:api-server
 * - urn:archimate-c4:acme:ecommerce:component:api-server/order-controller
 * - urn:archimate-c4:acme:ecommerce:code:api-server/order-controller/OrderService
 */
export function generateUrn(identifier: ArtifactIdentifier): string {
  const parts = [
    URN_PREFIX,
    sanitizeUrnPart(identifier.org),
    sanitizeUrnPart(identifier.repo),
    identifier.category,
    identifier.qualifier
      ? `${sanitizeUrnPart(identifier.qualifier)}/${sanitizeUrnPart(identifier.name)}`
      : sanitizeUrnPart(identifier.name)
  ];

  return parts.join(':');
}

/**
 * Parse a URN back into identifier components
 */
export function parseUrn(urn: string): ArtifactIdentifier | null {
  const parts = urn.split(':');

  if (parts.length < 5 || parts[0] !== 'urn' || parts[1] !== 'archimate-c4') {
    return null;
  }

  const [, , org, repo, category, ...rest] = parts;
  const namePart = rest.join(':');

  // Check if there's a qualifier (contains /)
  const slashIndex = namePart.lastIndexOf('/');
  const qualifier = slashIndex > 0 ? namePart.substring(0, slashIndex) : undefined;
  const name = slashIndex > 0 ? namePart.substring(slashIndex + 1) : namePart;

  return {
    org,
    repo,
    category: category as ArtifactCategory,
    name,
    qualifier
  };
}

/**
 * Sanitize a string for use in URN
 */
export function sanitizeUrnPart(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generate a canonical name from source information
 */
export function deriveCanonicalName(source: ArtifactSource, fallbackName: string): string {
  // Priority: packageName > filePath-based > fallback
  if (source.packageName) {
    return sanitizeUrnPart(source.packageName);
  }

  if (source.filePath) {
    // Extract meaningful name from file path
    const pathParts = source.filePath.split('/');
    const fileName = pathParts[pathParts.length - 1];
    // Remove extension
    const baseName = fileName.replace(/\.[^.]+$/, '');
    return sanitizeUrnPart(baseName);
  }

  return sanitizeUrnPart(fallbackName);
}

/**
 * Generate qualifier from source path
 */
export function deriveQualifier(source: ArtifactSource): string | undefined {
  if (!source.filePath) return undefined;

  const pathParts = source.filePath.split('/');
  // Remove file name, keep directory structure
  pathParts.pop();

  // Skip common root directories
  const skipDirs = new Set(['src', 'lib', 'app', 'packages', 'modules']);
  const meaningfulParts = pathParts.filter(p => !skipDirs.has(p) && p.length > 0);

  if (meaningfulParts.length === 0) return undefined;

  return meaningfulParts.map(sanitizeUrnPart).join('/');
}

/**
 * Create a new artifact registry
 */
export function createRegistry(id: string, name: string, repository?: string): ArtifactRegistry {
  const now = new Date().toISOString();

  return {
    id,
    name,
    repository,
    artifacts: new Map(),
    relationships: new Map(),
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Create a new artifact
 */
export function createArtifact(
  identifier: ArtifactIdentifier,
  displayName: string,
  options: Partial<Omit<Artifact, 'urn' | 'identifier' | 'category' | 'createdAt' | 'updatedAt' | 'version'>> = {}
): Artifact {
  const now = new Date().toISOString();

  return {
    urn: generateUrn(identifier),
    identifier,
    displayName,
    category: identifier.category,
    description: options.description,
    source: options.source,
    technology: options.technology,
    tags: options.tags || [],
    properties: options.properties || {},
    createdAt: now,
    updatedAt: now,
    version: 1
  };
}

/**
 * Create artifact from source analysis
 */
export function createArtifactFromSource(
  org: string,
  repo: string,
  category: ArtifactCategory,
  displayName: string,
  source: ArtifactSource,
  options: Partial<Omit<Artifact, 'urn' | 'identifier' | 'category' | 'source' | 'createdAt' | 'updatedAt' | 'version'>> = {}
): Artifact {
  const name = deriveCanonicalName(source, displayName);
  const qualifier = deriveQualifier(source);

  const identifier: ArtifactIdentifier = {
    org,
    repo,
    category,
    name,
    qualifier
  };

  return createArtifact(identifier, displayName, {
    ...options,
    source
  });
}

/**
 * Create a relationship between artifacts
 */
export function createRelationship(
  sourceUrn: string,
  targetUrn: string,
  type: RelationshipType,
  options: Partial<Omit<ArtifactRelationship, 'urn' | 'sourceUrn' | 'targetUrn' | 'type' | 'createdAt' | 'updatedAt'>> = {}
): ArtifactRelationship {
  const now = new Date().toISOString();

  // Generate deterministic relationship URN
  const relId = `${sanitizeUrnPart(sourceUrn)}--${type}--${sanitizeUrnPart(targetUrn)}`;
  const urn = `${URN_PREFIX}:rel:${relId}`;

  return {
    urn,
    sourceUrn,
    targetUrn,
    type,
    label: options.label,
    technology: options.technology,
    direction: options.direction || 'forward',
    source: options.source,
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Register or update an artifact in the registry
 */
export function registerArtifact(
  registry: ArtifactRegistry,
  artifact: Artifact
): ArtifactResolution {
  const existing = registry.artifacts.get(artifact.urn);

  if (existing) {
    // Update existing artifact
    const updated: Artifact = {
      ...existing,
      ...artifact,
      urn: existing.urn, // Preserve URN
      identifier: existing.identifier, // Preserve identifier
      createdAt: existing.createdAt, // Preserve creation time
      updatedAt: new Date().toISOString(),
      version: existing.version + 1
    };
    registry.artifacts.set(artifact.urn, updated);
    registry.updatedAt = new Date().toISOString();

    return { artifact: updated, isNew: false };
  }

  // Register new artifact
  registry.artifacts.set(artifact.urn, artifact);
  registry.updatedAt = new Date().toISOString();

  return { artifact, isNew: true };
}

/**
 * Register a relationship in the registry
 */
export function registerRelationship(
  registry: ArtifactRegistry,
  relationship: ArtifactRelationship
): ArtifactRelationship {
  const existing = registry.relationships.get(relationship.urn);

  if (existing) {
    // Update existing
    const updated: ArtifactRelationship = {
      ...existing,
      ...relationship,
      urn: existing.urn,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString()
    };
    registry.relationships.set(relationship.urn, updated);
    return updated;
  }

  registry.relationships.set(relationship.urn, relationship);
  registry.updatedAt = new Date().toISOString();
  return relationship;
}

/**
 * Resolve an artifact by URN
 */
export function resolveArtifact(
  registry: ArtifactRegistry,
  urn: string,
  includeRelationships = false
): ArtifactResolution {
  const artifact = registry.artifacts.get(urn) || null;

  if (!artifact || !includeRelationships) {
    return { artifact, isNew: false };
  }

  const inboundRelationships: ArtifactRelationship[] = [];
  const outboundRelationships: ArtifactRelationship[] = [];

  for (const rel of registry.relationships.values()) {
    if (rel.targetUrn === urn) {
      inboundRelationships.push(rel);
    }
    if (rel.sourceUrn === urn) {
      outboundRelationships.push(rel);
    }
  }

  return {
    artifact,
    isNew: false,
    inboundRelationships,
    outboundRelationships
  };
}

/**
 * Find artifact by name pattern
 */
export function findArtifactByName(
  registry: ArtifactRegistry,
  namePattern: string,
  category?: ArtifactCategory
): Artifact | null {
  const pattern = namePattern.toLowerCase();

  for (const artifact of registry.artifacts.values()) {
    if (category && artifact.category !== category) continue;

    if (
      artifact.identifier.name.toLowerCase() === pattern ||
      artifact.displayName.toLowerCase() === pattern ||
      artifact.urn.toLowerCase().includes(pattern)
    ) {
      return artifact;
    }
  }

  return null;
}

/**
 * Query artifacts with filters
 */
export function queryArtifacts(
  registry: ArtifactRegistry,
  query: ArtifactQuery
): Artifact[] {
  let results: Artifact[] = [];

  for (const artifact of registry.artifacts.values()) {
    // Filter by category
    if (query.category) {
      const categories = Array.isArray(query.category) ? query.category : [query.category];
      if (!categories.includes(artifact.category)) continue;
    }

    // Filter by tags (AND)
    if (query.tags && query.tags.length > 0) {
      const hasAllTags = query.tags.every(tag => artifact.tags?.includes(tag));
      if (!hasAllTags) continue;
    }

    // Filter by tags (OR)
    if (query.anyTags && query.anyTags.length > 0) {
      const hasAnyTag = query.anyTags.some(tag => artifact.tags?.includes(tag));
      if (!hasAnyTag) continue;
    }

    // Filter by repository
    if (query.repository && artifact.source?.repository !== query.repository) {
      continue;
    }

    // Filter by file path pattern
    if (query.filePathPattern && artifact.source?.filePath) {
      const pattern = new RegExp(query.filePathPattern);
      if (!pattern.test(artifact.source.filePath)) continue;
    }

    // Filter by technology
    if (query.technology && artifact.technology !== query.technology) {
      continue;
    }

    // Search in name/description
    if (query.search) {
      const searchLower = query.search.toLowerCase();
      const matchesName = artifact.displayName.toLowerCase().includes(searchLower);
      const matchesDesc = artifact.description?.toLowerCase().includes(searchLower);
      const matchesUrn = artifact.urn.toLowerCase().includes(searchLower);
      if (!matchesName && !matchesDesc && !matchesUrn) continue;
    }

    results.push(artifact);
  }

  // Apply limit
  if (query.limit && query.limit > 0) {
    results = results.slice(0, query.limit);
  }

  return results;
}

/**
 * Get all relationships for an artifact
 */
export function getArtifactRelationships(
  registry: ArtifactRegistry,
  urn: string
): { inbound: ArtifactRelationship[]; outbound: ArtifactRelationship[] } {
  const inbound: ArtifactRelationship[] = [];
  const outbound: ArtifactRelationship[] = [];

  for (const rel of registry.relationships.values()) {
    if (rel.targetUrn === urn) inbound.push(rel);
    if (rel.sourceUrn === urn) outbound.push(rel);
  }

  return { inbound, outbound };
}

/**
 * Serialize registry for persistence
 */
export function serializeRegistry(registry: ArtifactRegistry): ArtifactRegistryData {
  return {
    id: registry.id,
    name: registry.name,
    repository: registry.repository,
    artifacts: Object.fromEntries(registry.artifacts),
    relationships: Object.fromEntries(registry.relationships),
    schemaVersion: registry.schemaVersion,
    createdAt: registry.createdAt,
    updatedAt: registry.updatedAt
  };
}

/**
 * Deserialize registry from persistence
 */
export function deserializeRegistry(data: ArtifactRegistryData): ArtifactRegistry {
  return {
    id: data.id,
    name: data.name,
    repository: data.repository,
    artifacts: new Map(Object.entries(data.artifacts)),
    relationships: new Map(Object.entries(data.relationships)),
    schemaVersion: data.schemaVersion,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt
  };
}

/**
 * Get registry statistics
 */
export function getRegistryStats(registry: ArtifactRegistry): Record<string, number> {
  const stats: Record<string, number> = {
    totalArtifacts: registry.artifacts.size,
    totalRelationships: registry.relationships.size
  };

  // Count by category
  for (const artifact of registry.artifacts.values()) {
    const key = `artifacts_${artifact.category}`;
    stats[key] = (stats[key] || 0) + 1;
  }

  // Count by relationship type
  for (const rel of registry.relationships.values()) {
    const key = `relationships_${rel.type}`;
    stats[key] = (stats[key] || 0) + 1;
  }

  return stats;
}

/**
 * Lazy-loading registry wrapper
 *
 * Provides on-demand loading of artifacts from file storage.
 * Uses indexes for fast lookups without loading all artifacts into memory.
 */
export interface LazyRegistry {
  /** Registry metadata */
  readonly id: string;
  readonly name: string;
  readonly repository?: string;

  /** Check if artifact exists by URN */
  hasArtifact(urn: string): boolean;

  /** Get artifact by URN (loads from file if not cached) */
  getArtifact(urn: string): Promise<Artifact | null>;

  /** Get multiple artifacts by URNs */
  getArtifacts(urns: string[]): Promise<Map<string, Artifact>>;

  /** Query artifacts (may need to load from files) */
  query(query: ArtifactQuery): Promise<Artifact[]>;

  /** Get all artifact URNs */
  getAllUrns(): string[];

  /** Get artifact URNs by category */
  getUrnsByCategory(category: ArtifactCategory): string[];

  /** Get inbound relationship URNs for an artifact */
  getInboundRelationshipUrns(targetUrn: string): string[];

  /** Get outbound relationship URNs for an artifact */
  getOutboundRelationshipUrns(sourceUrn: string): string[];

  /** Get relationship by URN */
  getRelationship(urn: string): Promise<ArtifactRelationship | null>;

  /** Register or update an artifact */
  registerArtifact(artifact: Artifact): Promise<ArtifactResolution>;

  /** Register a relationship */
  registerRelationship(rel: ArtifactRelationship): Promise<ArtifactRelationship>;

  /** Delete an artifact */
  deleteArtifact(urn: string): Promise<boolean>;

  /** Delete a relationship */
  deleteRelationship(urn: string): Promise<boolean>;

  /** Get statistics from indexes (without loading files) */
  getStats(): {
    totalArtifacts: number;
    totalRelationships: number;
    byCategory: Record<string, number>;
    byRelType: Record<string, number>;
  };

  /** Convert to full registry (loads all artifacts) */
  toFullRegistry(): Promise<ArtifactRegistry>;

  /** Flush any pending changes to disk */
  flush(): Promise<void>;
}

/**
 * Create lazy registry from file storage
 */
export function createLazyRegistry(
  storage: {
    getMetadata(): { id: string; name: string; repository?: string } | null;
    getNameIndex(): import('../types/artifacts.js').NameIndex;
    getRelationshipIndex(): import('../types/artifacts.js').RelationshipIndex;
    loadArtifact(urn: string): Promise<Artifact | null>;
    loadRelationship(urn: string): Promise<ArtifactRelationship | null>;
    saveArtifact(artifact: Artifact): Promise<void>;
    saveRelationship(rel: ArtifactRelationship): Promise<void>;
    deleteArtifact(urn: string): Promise<boolean>;
    deleteRelationship(rel: ArtifactRelationship): Promise<boolean>;
    loadAllArtifacts(): Promise<Map<string, Artifact>>;
    loadAllRelationships(): Promise<Map<string, ArtifactRelationship>>;
    flush(): Promise<void>;
  }
): LazyRegistry {
  // Cache for loaded artifacts
  const artifactCache = new Map<string, Artifact>();
  const relationshipCache = new Map<string, ArtifactRelationship>();

  const metadata = storage.getMetadata();
  if (!metadata) {
    throw new Error('Storage not initialized');
  }

  return {
    id: metadata.id,
    name: metadata.name,
    repository: metadata.repository,

    hasArtifact(urn: string): boolean {
      const nameIndex = storage.getNameIndex();
      return urn in nameIndex.entries;
    },

    async getArtifact(urn: string): Promise<Artifact | null> {
      // Check cache first
      if (artifactCache.has(urn)) {
        return artifactCache.get(urn)!;
      }

      // Load from storage
      const artifact = await storage.loadArtifact(urn);
      if (artifact) {
        artifactCache.set(urn, artifact);
      }
      return artifact;
    },

    async getArtifacts(urns: string[]): Promise<Map<string, Artifact>> {
      const result = new Map<string, Artifact>();

      for (const urn of urns) {
        const artifact = await this.getArtifact(urn);
        if (artifact) {
          result.set(urn, artifact);
        }
      }

      return result;
    },

    async query(query: ArtifactQuery): Promise<Artifact[]> {
      const nameIndex = storage.getNameIndex();
      let candidateUrns: string[] = Object.keys(nameIndex.entries);

      // Filter by category using index
      if (query.category) {
        const categories = Array.isArray(query.category) ? query.category : [query.category];
        candidateUrns = candidateUrns.filter(urn => {
          const entry = nameIndex.entries[urn];
          return categories.includes(entry.category);
        });
      }

      // Filter by search term using index display names
      if (query.search) {
        const searchLower = query.search.toLowerCase();
        candidateUrns = candidateUrns.filter(urn => {
          const entry = nameIndex.entries[urn];
          return entry.displayName.toLowerCase().includes(searchLower) ||
                 urn.toLowerCase().includes(searchLower);
        });
      }

      // Apply limit before loading files
      if (query.limit && query.limit > 0 && candidateUrns.length > query.limit) {
        candidateUrns = candidateUrns.slice(0, query.limit);
      }

      // Load artifacts
      const artifacts: Artifact[] = [];
      for (const urn of candidateUrns) {
        const artifact = await this.getArtifact(urn);
        if (artifact) {
          // Apply remaining filters that require full artifact data
          if (query.tags && query.tags.length > 0) {
            const hasAllTags = query.tags.every(tag => artifact.tags?.includes(tag));
            if (!hasAllTags) continue;
          }

          if (query.anyTags && query.anyTags.length > 0) {
            const hasAnyTag = query.anyTags.some(tag => artifact.tags?.includes(tag));
            if (!hasAnyTag) continue;
          }

          if (query.technology && artifact.technology !== query.technology) {
            continue;
          }

          if (query.repository && artifact.source?.repository !== query.repository) {
            continue;
          }

          artifacts.push(artifact);
        }
      }

      return artifacts;
    },

    getAllUrns(): string[] {
      const nameIndex = storage.getNameIndex();
      return Object.keys(nameIndex.entries);
    },

    getUrnsByCategory(category: ArtifactCategory): string[] {
      const nameIndex = storage.getNameIndex();
      return Object.entries(nameIndex.entries)
        .filter(([_, entry]) => entry.category === category)
        .map(([urn]) => urn);
    },

    getInboundRelationshipUrns(targetUrn: string): string[] {
      const relIndex = storage.getRelationshipIndex();
      return relIndex.byTarget[targetUrn] || [];
    },

    getOutboundRelationshipUrns(sourceUrn: string): string[] {
      const relIndex = storage.getRelationshipIndex();
      return relIndex.bySource[sourceUrn] || [];
    },

    async getRelationship(urn: string): Promise<ArtifactRelationship | null> {
      // Check cache first
      if (relationshipCache.has(urn)) {
        return relationshipCache.get(urn)!;
      }

      // Load from storage
      const rel = await storage.loadRelationship(urn);
      if (rel) {
        relationshipCache.set(urn, rel);
      }
      return rel;
    },

    async registerArtifact(artifact: Artifact): Promise<ArtifactResolution> {
      const existing = await this.getArtifact(artifact.urn);
      const isNew = !existing;

      if (existing) {
        // Update existing artifact
        const updated: Artifact = {
          ...existing,
          ...artifact,
          urn: existing.urn,
          identifier: existing.identifier,
          createdAt: existing.createdAt,
          updatedAt: new Date().toISOString(),
          version: existing.version + 1
        };
        await storage.saveArtifact(updated);
        artifactCache.set(updated.urn, updated);
        return { artifact: updated, isNew: false };
      }

      // Register new artifact
      await storage.saveArtifact(artifact);
      artifactCache.set(artifact.urn, artifact);
      return { artifact, isNew: true };
    },

    async registerRelationship(rel: ArtifactRelationship): Promise<ArtifactRelationship> {
      const existing = await this.getRelationship(rel.urn);

      if (existing) {
        const updated: ArtifactRelationship = {
          ...existing,
          ...rel,
          urn: existing.urn,
          createdAt: existing.createdAt,
          updatedAt: new Date().toISOString()
        };
        await storage.saveRelationship(updated);
        relationshipCache.set(updated.urn, updated);
        return updated;
      }

      await storage.saveRelationship(rel);
      relationshipCache.set(rel.urn, rel);
      return rel;
    },

    async deleteArtifact(urn: string): Promise<boolean> {
      const result = await storage.deleteArtifact(urn);
      if (result) {
        artifactCache.delete(urn);
      }
      return result;
    },

    async deleteRelationship(urn: string): Promise<boolean> {
      const rel = await this.getRelationship(urn);
      if (!rel) return false;

      const result = await storage.deleteRelationship(rel);
      if (result) {
        relationshipCache.delete(urn);
      }
      return result;
    },

    getStats(): {
      totalArtifacts: number;
      totalRelationships: number;
      byCategory: Record<string, number>;
      byRelType: Record<string, number>;
    } {
      const nameIndex = storage.getNameIndex();
      const relIndex = storage.getRelationshipIndex();

      const byCategory: Record<string, number> = {};
      for (const entry of Object.values(nameIndex.entries)) {
        byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
      }

      const byRelType: Record<string, number> = {};
      for (const entry of Object.values(relIndex.entries)) {
        byRelType[entry.type] = (byRelType[entry.type] || 0) + 1;
      }

      return {
        totalArtifacts: Object.keys(nameIndex.entries).length,
        totalRelationships: Object.keys(relIndex.entries).length,
        byCategory,
        byRelType
      };
    },

    async toFullRegistry(): Promise<ArtifactRegistry> {
      const artifacts = await storage.loadAllArtifacts();
      const relationships = await storage.loadAllRelationships();

      return {
        id: metadata.id,
        name: metadata.name,
        repository: metadata.repository,
        artifacts,
        relationships,
        schemaVersion: SCHEMA_VERSION,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    },

    async flush(): Promise<void> {
      await storage.flush();
    }
  };
}
