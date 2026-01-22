/**
 * QMD Integration
 *
 * Provides integration with QMD (Query Markdown) for semantic search
 * over architecture artifacts stored in markdown format.
 *
 * QMD is an external MCP server that provides:
 * - BM25 text search
 * - Vector similarity search
 * - LLM re-ranking
 *
 * This module provides a wrapper with graceful fallback when QMD is unavailable.
 */

import type { NameIndex, Artifact, ArtifactCategory } from '../types/artifacts.js';

/**
 * QMD search result
 */
export interface QmdSearchResult {
  /** File path */
  path: string;
  /** Relevance score (0-1) */
  score: number;
  /** Matched content snippet */
  snippet?: string;
  /** Extracted URN from frontmatter */
  urn?: string;
  /** Extracted display name */
  displayName?: string;
  /** Extracted category */
  category?: ArtifactCategory;
}

/**
 * QMD query options
 */
export interface QmdQueryOptions {
  /** Collection name (default: 'architecture') */
  collection?: string;
  /** Maximum number of results */
  limit?: number;
  /** Search mode */
  mode?: 'search' | 'vsearch' | 'query';
  /** Filter by file pattern */
  filePattern?: string;
  /** Minimum relevance score */
  minScore?: number;
}

/**
 * QMD availability status
 */
export interface QmdStatus {
  available: boolean;
  error?: string;
  collections?: string[];
}

/**
 * QMD MCP client interface
 *
 * This interface represents the expected QMD MCP tool interface.
 * The actual implementation depends on the MCP server configuration.
 */
export interface QmdMcpClient {
  /** Check if QMD is available */
  ping(): Promise<boolean>;

  /** List available collections */
  listCollections(): Promise<string[]>;

  /** Search using BM25 text search */
  search(collection: string, query: string, limit?: number): Promise<QmdSearchResult[]>;

  /** Search using vector similarity */
  vsearch(collection: string, query: string, limit?: number): Promise<QmdSearchResult[]>;

  /** Query with LLM re-ranking */
  query(collection: string, query: string, limit?: number): Promise<QmdSearchResult[]>;

  /** Add files to collection */
  add(collection: string, pattern: string): Promise<{ added: number }>;

  /** Refresh collection index */
  refresh(collection: string): Promise<void>;
}

/**
 * Default collection name for architecture artifacts
 */
export const ARCHITECTURE_COLLECTION = 'architecture';

/**
 * Default file pattern for architecture artifacts
 */
export const ARCHITECTURE_FILE_PATTERN = '.architecture/**/*.md';

/**
 * Check if QMD is available
 *
 * In practice, this would check if the QMD MCP server is configured
 * and responding. This is a placeholder for the actual implementation.
 */
export async function checkQmdAvailability(
  client?: QmdMcpClient
): Promise<QmdStatus> {
  if (!client) {
    return {
      available: false,
      error: 'QMD client not provided. Configure QMD as an MCP server.'
    };
  }

  try {
    const available = await client.ping();
    if (!available) {
      return {
        available: false,
        error: 'QMD server not responding'
      };
    }

    const collections = await client.listCollections();
    return {
      available: true,
      collections
    };
  } catch (error) {
    return {
      available: false,
      error: `QMD error: ${error}`
    };
  }
}

/**
 * Search architecture artifacts using QMD
 *
 * Falls back to index-based search if QMD is unavailable.
 */
export async function searchWithQmd(
  query: string,
  options: QmdQueryOptions = {},
  client?: QmdMcpClient
): Promise<QmdSearchResult[]> {
  const collection = options.collection || ARCHITECTURE_COLLECTION;
  const limit = options.limit || 20;
  const mode = options.mode || 'search';

  // Check QMD availability
  const status = await checkQmdAvailability(client);
  if (!status.available || !client) {
    throw new Error(
      status.error || 'QMD not available. Use fallback search instead.'
    );
  }

  // Check if collection exists
  if (status.collections && !status.collections.includes(collection)) {
    throw new Error(
      `Collection '${collection}' not found. ` +
      `Run 'qmd add ${collection} "${ARCHITECTURE_FILE_PATTERN}"' to create it.`
    );
  }

  // Execute search based on mode
  let results: QmdSearchResult[];
  switch (mode) {
    case 'vsearch':
      results = await client.vsearch(collection, query, limit);
      break;
    case 'query':
      results = await client.query(collection, query, limit);
      break;
    case 'search':
    default:
      results = await client.search(collection, query, limit);
  }

  // Filter by minimum score if specified
  if (options.minScore !== undefined) {
    results = results.filter(r => r.score >= options.minScore!);
  }

  // Filter by file pattern if specified
  if (options.filePattern) {
    const pattern = new RegExp(options.filePattern);
    results = results.filter(r => pattern.test(r.path));
  }

  return results;
}

/**
 * Fallback search using name index
 *
 * Used when QMD is not available. Performs simple text matching
 * on display names and URNs.
 */
export function fallbackSearch(
  query: string,
  nameIndex: NameIndex,
  options: { limit?: number; category?: ArtifactCategory } = {}
): QmdSearchResult[] {
  const limit = options.limit || 20;
  const queryLower = query.toLowerCase();

  // Score each entry
  const scored: Array<{ urn: string; score: number }> = [];

  for (const [urn, entry] of Object.entries(nameIndex.entries)) {
    // Filter by category if specified
    if (options.category && entry.category !== options.category) {
      continue;
    }

    // Calculate simple relevance score
    let score = 0;
    const displayNameLower = entry.displayName.toLowerCase();
    const urnLower = urn.toLowerCase();

    // Exact match in display name
    if (displayNameLower === queryLower) {
      score = 1.0;
    }
    // Display name starts with query
    else if (displayNameLower.startsWith(queryLower)) {
      score = 0.9;
    }
    // Display name contains query
    else if (displayNameLower.includes(queryLower)) {
      score = 0.7;
    }
    // URN contains query
    else if (urnLower.includes(queryLower)) {
      score = 0.5;
    }

    if (score > 0) {
      scored.push({ urn, score });
    }
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Take top N and convert to results
  return scored.slice(0, limit).map(({ urn, score }) => {
    const entry = nameIndex.entries[urn];
    return {
      path: entry.filePath,
      score,
      urn,
      displayName: entry.displayName,
      category: entry.category
    };
  });
}

/**
 * Initialize QMD collection for architecture artifacts
 *
 * This creates/updates the QMD collection with the architecture files.
 */
export async function initializeQmdCollection(
  client: QmdMcpClient,
  options: {
    collection?: string;
    filePattern?: string;
    refresh?: boolean;
  } = {}
): Promise<{ success: boolean; added?: number; error?: string }> {
  const collection = options.collection || ARCHITECTURE_COLLECTION;
  const filePattern = options.filePattern || ARCHITECTURE_FILE_PATTERN;

  try {
    // Add files to collection
    const result = await client.add(collection, filePattern);

    // Refresh if requested
    if (options.refresh) {
      await client.refresh(collection);
    }

    return { success: true, added: result.added };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Generate QMD setup instructions
 */
export function generateQmdSetupInstructions(projectRoot: string): string {
  return `# QMD Setup for Architecture Search

QMD (Query Markdown) enables semantic search over your architecture artifacts.

## Installation

Install QMD:
\`\`\`bash
npm install -g qmd
# or
brew install qmd
\`\`\`

## MCP Server Configuration

Add QMD to your MCP server configuration:

\`\`\`json
{
  "mcpServers": {
    "qmd": {
      "command": "qmd",
      "args": ["mcp"]
    }
  }
}
\`\`\`

## Initialize Collection

Add your architecture files to a QMD collection:
\`\`\`bash
cd ${projectRoot}
qmd add ${ARCHITECTURE_COLLECTION} "${ARCHITECTURE_FILE_PATTERN}"
\`\`\`

## Search Commands

Once configured, you can search using:

**Text search (BM25):**
\`\`\`
qmd search ${ARCHITECTURE_COLLECTION} "payment processing"
\`\`\`

**Vector search (similarity):**
\`\`\`
qmd vsearch ${ARCHITECTURE_COLLECTION} "components that handle user authentication"
\`\`\`

**LLM-enhanced query:**
\`\`\`
qmd query ${ARCHITECTURE_COLLECTION} "what system processes orders?"
\`\`\`

## Refresh After Changes

When you add or modify artifacts, refresh the index:
\`\`\`bash
qmd refresh ${ARCHITECTURE_COLLECTION}
\`\`\`

## Integration

The plugin automatically uses QMD when available via MCP.
Use \`/arch-registry search "query"\` to search.
`;
}

/**
 * Extract URN from QMD search result file path
 *
 * Since QMD returns file paths, we need to extract the URN
 * by reading the file or using the name index.
 */
export function extractUrnFromPath(
  filePath: string,
  nameIndex: NameIndex
): string | null {
  // Search name index for matching file path
  for (const [urn, entry] of Object.entries(nameIndex.entries)) {
    if (entry.filePath === filePath || filePath.endsWith(entry.filePath)) {
      return urn;
    }
  }
  return null;
}

/**
 * Enrich QMD results with artifact metadata from index
 */
export function enrichQmdResults(
  results: QmdSearchResult[],
  nameIndex: NameIndex
): QmdSearchResult[] {
  return results.map(result => {
    // Try to find URN from path
    const urn = extractUrnFromPath(result.path, nameIndex);
    if (urn && nameIndex.entries[urn]) {
      const entry = nameIndex.entries[urn];
      return {
        ...result,
        urn,
        displayName: entry.displayName,
        category: entry.category
      };
    }
    return result;
  });
}

/**
 * Format search results for display
 */
export function formatSearchResults(results: QmdSearchResult[]): string {
  if (results.length === 0) {
    return 'No results found.';
  }

  const lines: string[] = [
    '| Score | Name | Category | URN |',
    '|-------|------|----------|-----|'
  ];

  for (const result of results) {
    const score = (result.score * 100).toFixed(0) + '%';
    const name = result.displayName || result.path.split('/').pop() || '-';
    const category = result.category || '-';
    const urn = result.urn ? `\`${result.urn.split(':').slice(-2).join(':')}\`` : '-';
    lines.push(`| ${score} | ${name} | ${category} | ${urn} |`);
  }

  return lines.join('\n');
}
