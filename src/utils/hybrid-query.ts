/**
 * Hybrid Query System
 *
 * Combines fast index lookups with QMD semantic search for optimal
 * artifact discovery. Routes queries based on type:
 *
 * | Query Type           | Method                          |
 * |---------------------|---------------------------------|
 * | URN lookup          | Name index O(1)                 |
 * | Category filter     | Name index scan by prefix       |
 * | Relationship graph  | Relationship index O(1)         |
 * | Full-text search    | QMD or index fallback           |
 * | Semantic search     | QMD                             |
 * | Multi-filter        | Index narrowing + QMD           |
 */

import type {
  Artifact,
  ArtifactRelationship,
  ArtifactCategory,
  ArtifactQuery,
  NameIndex,
  RelationshipIndex
} from '../types/artifacts.js';
import {
  lookupArtifact,
  filterByCategory,
  searchDisplayNames,
  findInboundRelationships,
  findOutboundRelationships
} from './index-manager.js';
import {
  searchWithQmd,
  fallbackSearch,
  enrichQmdResults,
  checkQmdAvailability,
  type QmdMcpClient,
  type QmdSearchResult,
  type QmdQueryOptions
} from './qmd-integration.js';

/**
 * Query type classification
 */
export type QueryType =
  | 'urn_lookup'      // Direct URN lookup
  | 'category_filter' // Filter by category
  | 'tag_filter'      // Filter by tags
  | 'text_search'     // Full-text search
  | 'semantic_search' // Semantic/vector search
  | 'relationship'    // Relationship traversal
  | 'multi_filter';   // Complex multi-field filter

/**
 * Query plan showing how query will be executed
 */
export interface QueryPlan {
  type: QueryType;
  useIndex: boolean;
  useQmd: boolean;
  narrowingFilters: string[];
  estimatedCost: 'low' | 'medium' | 'high';
}

/**
 * Hybrid query options
 */
export interface HybridQueryOptions {
  /** QMD client (optional, enables semantic search) */
  qmdClient?: QmdMcpClient;
  /** Force QMD search even when index might suffice */
  preferQmd?: boolean;
  /** Maximum results */
  limit?: number;
  /** Minimum relevance score for QMD results */
  minScore?: number;
}

/**
 * Artifact loader function type
 */
export type ArtifactLoader = (urn: string) => Promise<Artifact | null>;

/**
 * Relationship loader function type
 */
export type RelationshipLoader = (urn: string) => Promise<ArtifactRelationship | null>;

/**
 * Classify query type based on query parameters
 */
export function classifyQuery(query: ArtifactQuery): QueryType {
  const hasSearch = !!query.search;
  const hasCategory = !!query.category;
  const hasTags = !!(query.tags?.length || query.anyTags?.length);
  const hasFilePattern = !!query.filePathPattern;
  const hasTechnology = !!query.technology;
  const hasRepository = !!query.repository;

  // Check for URN-like search (exact match)
  if (hasSearch && query.search!.startsWith('urn:')) {
    return 'urn_lookup';
  }

  // Multiple filters = complex query
  const filterCount = [hasCategory, hasTags, hasFilePattern, hasTechnology, hasRepository]
    .filter(Boolean).length;

  if (filterCount > 1) {
    return 'multi_filter';
  }

  // Single filters
  if (hasCategory && !hasSearch) {
    return 'category_filter';
  }

  if (hasTags && !hasSearch) {
    return 'tag_filter';
  }

  // Search queries
  if (hasSearch) {
    // Check if query looks like a semantic question
    const questionWords = ['what', 'which', 'how', 'where', 'why', 'when', 'find', 'show'];
    const queryLower = query.search!.toLowerCase();
    const isSemanticQuery = questionWords.some(w => queryLower.startsWith(w));

    if (isSemanticQuery) {
      return 'semantic_search';
    }

    return 'text_search';
  }

  // Default to simple filter
  return 'category_filter';
}

/**
 * Plan query execution
 */
export function planQuery(
  query: ArtifactQuery,
  options: HybridQueryOptions = {}
): QueryPlan {
  const type = classifyQuery(query);
  const qmdAvailable = !!options.qmdClient;

  switch (type) {
    case 'urn_lookup':
      return {
        type,
        useIndex: true,
        useQmd: false,
        narrowingFilters: [],
        estimatedCost: 'low'
      };

    case 'category_filter':
      return {
        type,
        useIndex: true,
        useQmd: false,
        narrowingFilters: query.category ? [String(query.category)] : [],
        estimatedCost: 'low'
      };

    case 'tag_filter':
      return {
        type,
        useIndex: false, // Tags require loading artifacts
        useQmd: qmdAvailable && (options.preferQmd ?? false),
        narrowingFilters: query.tags || query.anyTags || [],
        estimatedCost: 'medium'
      };

    case 'text_search':
      return {
        type,
        useIndex: !qmdAvailable,
        useQmd: qmdAvailable,
        narrowingFilters: [],
        estimatedCost: qmdAvailable ? 'medium' : 'high'
      };

    case 'semantic_search':
      return {
        type,
        useIndex: !qmdAvailable, // Fallback if no QMD
        useQmd: qmdAvailable,
        narrowingFilters: [],
        estimatedCost: qmdAvailable ? 'medium' : 'high'
      };

    case 'multi_filter':
      return {
        type,
        useIndex: true, // Use index for initial narrowing
        useQmd: qmdAvailable && !!query.search,
        narrowingFilters: [
          query.category ? `category:${query.category}` : '',
          query.technology ? `tech:${query.technology}` : '',
          query.repository ? `repo:${query.repository}` : ''
        ].filter(Boolean),
        estimatedCost: 'high'
      };

    default:
      return {
        type: 'category_filter',
        useIndex: true,
        useQmd: false,
        narrowingFilters: [],
        estimatedCost: 'low'
      };
  }
}

/**
 * Execute hybrid query
 */
export async function executeHybridQuery(
  query: ArtifactQuery,
  nameIndex: NameIndex,
  loadArtifact: ArtifactLoader,
  options: HybridQueryOptions = {}
): Promise<Artifact[]> {
  const plan = planQuery(query, options);
  const limit = options.limit || query.limit || 100;

  // URN lookup - fastest path
  if (plan.type === 'urn_lookup' && query.search) {
    const entry = lookupArtifact(nameIndex, query.search);
    if (entry) {
      const artifact = await loadArtifact(query.search);
      return artifact ? [artifact] : [];
    }
    return [];
  }

  // Category filter - use index
  if (plan.type === 'category_filter' && query.category) {
    const categories = Array.isArray(query.category) ? query.category : [query.category];
    const entries = categories.flatMap(cat => filterByCategory(nameIndex, cat));

    const artifacts: Artifact[] = [];
    for (const entry of entries.slice(0, limit)) {
      const urn = Object.entries(nameIndex.entries)
        .find(([_, e]) => e === entry)?.[0];
      if (urn) {
        const artifact = await loadArtifact(urn);
        if (artifact) artifacts.push(artifact);
      }
    }
    return artifacts;
  }

  // QMD search path
  if (plan.useQmd && options.qmdClient) {
    try {
      const qmdOptions: QmdQueryOptions = {
        limit,
        mode: plan.type === 'semantic_search' ? 'query' : 'search',
        minScore: options.minScore
      };

      const results = await searchWithQmd(
        query.search || '',
        qmdOptions,
        options.qmdClient
      );

      // Enrich with index data
      const enriched = enrichQmdResults(results, nameIndex);

      // Load full artifacts
      const artifacts: Artifact[] = [];
      for (const result of enriched) {
        if (result.urn) {
          const artifact = await loadArtifact(result.urn);
          if (artifact) {
            // Apply remaining filters
            if (matchesFilters(artifact, query)) {
              artifacts.push(artifact);
            }
          }
        }
      }

      return artifacts;
    } catch (error) {
      // Fall back to index search
      console.warn('QMD search failed, falling back to index:', error);
    }
  }

  // Fallback: index-based search
  if (query.search) {
    const results = fallbackSearch(query.search, nameIndex, {
      limit,
      category: query.category as ArtifactCategory | undefined
    });

    const artifacts: Artifact[] = [];
    for (const result of results) {
      if (result.urn) {
        const artifact = await loadArtifact(result.urn);
        if (artifact && matchesFilters(artifact, query)) {
          artifacts.push(artifact);
        }
      }
    }

    return artifacts;
  }

  // No search term - scan index with filters
  const allUrns = Object.keys(nameIndex.entries);
  const artifacts: Artifact[] = [];

  for (const urn of allUrns) {
    if (artifacts.length >= limit) break;

    const entry = nameIndex.entries[urn];

    // Quick category filter from index
    if (query.category) {
      const categories = Array.isArray(query.category) ? query.category : [query.category];
      if (!categories.includes(entry.category)) continue;
    }

    // Load artifact for remaining filters
    const artifact = await loadArtifact(urn);
    if (artifact && matchesFilters(artifact, query)) {
      artifacts.push(artifact);
    }
  }

  return artifacts;
}

/**
 * Execute relationship query
 */
export async function queryRelationships(
  artifactUrn: string,
  direction: 'inbound' | 'outbound' | 'both',
  relIndex: RelationshipIndex,
  loadRelationship: RelationshipLoader
): Promise<ArtifactRelationship[]> {
  const relationshipUrns: string[] = [];

  if (direction === 'inbound' || direction === 'both') {
    const inbound = findInboundRelationships(relIndex, artifactUrn);
    relationshipUrns.push(...inbound.map(e => e.urn));
  }

  if (direction === 'outbound' || direction === 'both') {
    const outbound = findOutboundRelationships(relIndex, artifactUrn);
    relationshipUrns.push(...outbound.map(e => e.urn));
  }

  // Load relationships
  const relationships: ArtifactRelationship[] = [];
  for (const urn of relationshipUrns) {
    const rel = await loadRelationship(urn);
    if (rel) relationships.push(rel);
  }

  return relationships;
}

/**
 * Find connected artifacts (graph traversal)
 */
export async function findConnectedArtifacts(
  startUrn: string,
  depth: number,
  nameIndex: NameIndex,
  relIndex: RelationshipIndex,
  loadArtifact: ArtifactLoader
): Promise<Map<string, { artifact: Artifact; distance: number }>> {
  const visited = new Map<string, { artifact: Artifact; distance: number }>();
  const queue: Array<{ urn: string; distance: number }> = [{ urn: startUrn, distance: 0 }];

  while (queue.length > 0) {
    const { urn, distance } = queue.shift()!;

    if (visited.has(urn) || distance > depth) continue;

    const artifact = await loadArtifact(urn);
    if (!artifact) continue;

    visited.set(urn, { artifact, distance });

    // Find connected via relationships
    if (distance < depth) {
      const outbound = findOutboundRelationships(relIndex, urn);
      const inbound = findInboundRelationships(relIndex, urn);

      for (const entry of [...outbound, ...inbound]) {
        const connectedUrn = entry.sourceUrn === urn ? entry.targetUrn : entry.sourceUrn;
        if (!visited.has(connectedUrn)) {
          queue.push({ urn: connectedUrn, distance: distance + 1 });
        }
      }
    }
  }

  return visited;
}

/**
 * Check if artifact matches query filters
 */
function matchesFilters(artifact: Artifact, query: ArtifactQuery): boolean {
  // Category filter
  if (query.category) {
    const categories = Array.isArray(query.category) ? query.category : [query.category];
    if (!categories.includes(artifact.category)) return false;
  }

  // Tags filter (AND)
  if (query.tags && query.tags.length > 0) {
    const hasAllTags = query.tags.every(tag => artifact.tags?.includes(tag));
    if (!hasAllTags) return false;
  }

  // Tags filter (OR)
  if (query.anyTags && query.anyTags.length > 0) {
    const hasAnyTag = query.anyTags.some(tag => artifact.tags?.includes(tag));
    if (!hasAnyTag) return false;
  }

  // Repository filter
  if (query.repository && artifact.source?.repository !== query.repository) {
    return false;
  }

  // File path pattern filter
  if (query.filePathPattern && artifact.source?.filePath) {
    const pattern = new RegExp(query.filePathPattern);
    if (!pattern.test(artifact.source.filePath)) return false;
  }

  // Technology filter
  if (query.technology && artifact.technology !== query.technology) {
    return false;
  }

  return true;
}

/**
 * Create a hybrid query executor bound to storage
 */
export function createHybridQueryExecutor(
  nameIndex: NameIndex,
  relIndex: RelationshipIndex,
  loadArtifact: ArtifactLoader,
  loadRelationship: RelationshipLoader,
  qmdClient?: QmdMcpClient
) {
  return {
    /**
     * Query artifacts
     */
    async query(
      query: ArtifactQuery,
      options?: Omit<HybridQueryOptions, 'qmdClient'>
    ): Promise<Artifact[]> {
      return executeHybridQuery(query, nameIndex, loadArtifact, {
        ...options,
        qmdClient
      });
    },

    /**
     * Get artifact by URN
     */
    async getByUrn(urn: string): Promise<Artifact | null> {
      return loadArtifact(urn);
    },

    /**
     * Search with text query
     */
    async search(
      searchTerm: string,
      options?: { category?: ArtifactCategory; limit?: number }
    ): Promise<Artifact[]> {
      return executeHybridQuery(
        { search: searchTerm, category: options?.category, limit: options?.limit },
        nameIndex,
        loadArtifact,
        { qmdClient }
      );
    },

    /**
     * Get relationships for artifact
     */
    async getRelationships(
      artifactUrn: string,
      direction: 'inbound' | 'outbound' | 'both' = 'both'
    ): Promise<ArtifactRelationship[]> {
      return queryRelationships(artifactUrn, direction, relIndex, loadRelationship);
    },

    /**
     * Find connected artifacts
     */
    async findConnected(
      startUrn: string,
      depth: number = 1
    ): Promise<Map<string, { artifact: Artifact; distance: number }>> {
      return findConnectedArtifacts(startUrn, depth, nameIndex, relIndex, loadArtifact);
    },

    /**
     * Get query plan
     */
    plan(query: ArtifactQuery): QueryPlan {
      return planQuery(query, { qmdClient });
    },

    /**
     * Check QMD availability
     */
    async checkQmd(): Promise<{ available: boolean; error?: string }> {
      if (!qmdClient) {
        return { available: false, error: 'QMD client not configured' };
      }
      return checkQmdAvailability(qmdClient);
    }
  };
}

export type HybridQueryExecutor = ReturnType<typeof createHybridQueryExecutor>;
