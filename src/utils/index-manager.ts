/**
 * Index Manager
 *
 * Manages the .name-index.json and .rel-index.json files for O(1) lookups.
 * These indexes enable fast artifact and relationship resolution without
 * scanning all markdown files.
 */

import type { FileSystemAdapter } from './artifact-persistence.js';
import type {
  NameIndex,
  NameIndexEntry,
  RelationshipIndex,
  RelationshipIndexEntry,
  Artifact,
  ArtifactRelationship,
  ArtifactCategory
} from '../types/artifacts.js';

/** Index file names */
export const NAME_INDEX_FILE = '.name-index.json';
export const REL_INDEX_FILE = '.rel-index.json';

/** Current index version */
export const INDEX_VERSION = '1.0.0';

/**
 * Create an empty name index
 */
export function createNameIndex(): NameIndex {
  return {
    version: INDEX_VERSION,
    entries: {},
    lastRebuilt: new Date().toISOString()
  };
}

/**
 * Create an empty relationship index
 */
export function createRelationshipIndex(): RelationshipIndex {
  return {
    version: INDEX_VERSION,
    entries: {},
    bySource: {},
    byTarget: {},
    lastRebuilt: new Date().toISOString()
  };
}

/**
 * Load name index from file
 */
export async function loadNameIndex(
  fs: FileSystemAdapter,
  basePath: string
): Promise<NameIndex> {
  const indexPath = `${basePath}/${NAME_INDEX_FILE}`;

  try {
    const exists = await fs.exists(indexPath);
    if (!exists) {
      return createNameIndex();
    }

    const content = await fs.readFile(indexPath);
    const index = JSON.parse(content) as NameIndex;

    // Check version and migrate if needed
    if (index.version !== INDEX_VERSION) {
      return migrateNameIndex(index);
    }

    return index;
  } catch {
    return createNameIndex();
  }
}

/**
 * Save name index to file
 */
export async function saveNameIndex(
  fs: FileSystemAdapter,
  basePath: string,
  index: NameIndex
): Promise<void> {
  const indexPath = `${basePath}/${NAME_INDEX_FILE}`;
  const content = JSON.stringify(index, null, 2);
  await fs.writeFile(indexPath, content);
}

/**
 * Load relationship index from file
 */
export async function loadRelationshipIndex(
  fs: FileSystemAdapter,
  basePath: string
): Promise<RelationshipIndex> {
  const indexPath = `${basePath}/${REL_INDEX_FILE}`;

  try {
    const exists = await fs.exists(indexPath);
    if (!exists) {
      return createRelationshipIndex();
    }

    const content = await fs.readFile(indexPath);
    const index = JSON.parse(content) as RelationshipIndex;

    // Check version and migrate if needed
    if (index.version !== INDEX_VERSION) {
      return migrateRelationshipIndex(index);
    }

    return index;
  } catch {
    return createRelationshipIndex();
  }
}

/**
 * Save relationship index to file
 */
export async function saveRelationshipIndex(
  fs: FileSystemAdapter,
  basePath: string,
  index: RelationshipIndex
): Promise<void> {
  const indexPath = `${basePath}/${REL_INDEX_FILE}`;
  const content = JSON.stringify(index, null, 2);
  await fs.writeFile(indexPath, content);
}

/**
 * Add or update artifact in name index
 */
export function indexArtifact(
  index: NameIndex,
  artifact: Artifact,
  filePath: string
): void {
  index.entries[artifact.urn] = {
    filePath,
    category: artifact.category,
    displayName: artifact.displayName,
    updatedAt: artifact.updatedAt
  };
}

/**
 * Remove artifact from name index
 */
export function unindexArtifact(
  index: NameIndex,
  urn: string
): void {
  delete index.entries[urn];
}

/**
 * Add or update relationship in relationship index
 */
export function indexRelationship(
  index: RelationshipIndex,
  rel: ArtifactRelationship,
  filePath: string
): void {
  const entry: RelationshipIndexEntry = {
    urn: rel.urn,
    filePath,
    sourceUrn: rel.sourceUrn,
    targetUrn: rel.targetUrn,
    type: rel.type,
    updatedAt: rel.updatedAt
  };

  // Update main entry
  index.entries[rel.urn] = entry;

  // Update bySource index
  if (!index.bySource[rel.sourceUrn]) {
    index.bySource[rel.sourceUrn] = [];
  }
  if (!index.bySource[rel.sourceUrn].includes(rel.urn)) {
    index.bySource[rel.sourceUrn].push(rel.urn);
  }

  // Update byTarget index
  if (!index.byTarget[rel.targetUrn]) {
    index.byTarget[rel.targetUrn] = [];
  }
  if (!index.byTarget[rel.targetUrn].includes(rel.urn)) {
    index.byTarget[rel.targetUrn].push(rel.urn);
  }
}

/**
 * Remove relationship from relationship index
 */
export function unindexRelationship(
  index: RelationshipIndex,
  rel: ArtifactRelationship
): void {
  const entry = index.entries[rel.urn];
  if (!entry) return;

  // Remove from main entries
  delete index.entries[rel.urn];

  // Remove from bySource
  const sourceList = index.bySource[entry.sourceUrn];
  if (sourceList) {
    const idx = sourceList.indexOf(rel.urn);
    if (idx !== -1) {
      sourceList.splice(idx, 1);
    }
    if (sourceList.length === 0) {
      delete index.bySource[entry.sourceUrn];
    }
  }

  // Remove from byTarget
  const targetList = index.byTarget[entry.targetUrn];
  if (targetList) {
    const idx = targetList.indexOf(rel.urn);
    if (idx !== -1) {
      targetList.splice(idx, 1);
    }
    if (targetList.length === 0) {
      delete index.byTarget[entry.targetUrn];
    }
  }
}

/**
 * Lookup artifact file path by URN (O(1))
 */
export function lookupArtifact(
  index: NameIndex,
  urn: string
): NameIndexEntry | null {
  return index.entries[urn] || null;
}

/**
 * Lookup relationship file path by URN (O(1))
 */
export function lookupRelationship(
  index: RelationshipIndex,
  urn: string
): RelationshipIndexEntry | null {
  return index.entries[urn] || null;
}

/**
 * Find all outbound relationships for an artifact (O(1) to get URNs)
 */
export function findOutboundRelationships(
  index: RelationshipIndex,
  sourceUrn: string
): RelationshipIndexEntry[] {
  const urns = index.bySource[sourceUrn] || [];
  return urns.map(urn => index.entries[urn]).filter(Boolean);
}

/**
 * Find all inbound relationships for an artifact (O(1) to get URNs)
 */
export function findInboundRelationships(
  index: RelationshipIndex,
  targetUrn: string
): RelationshipIndexEntry[] {
  const urns = index.byTarget[targetUrn] || [];
  return urns.map(urn => index.entries[urn]).filter(Boolean);
}

/**
 * Filter artifacts by category (O(n) scan of index, not files)
 */
export function filterByCategory(
  index: NameIndex,
  category: ArtifactCategory
): NameIndexEntry[] {
  return Object.values(index.entries).filter(e => e.category === category);
}

/**
 * Filter artifacts by category prefix in URN (O(n) scan of index)
 */
export function filterByCategoryPrefix(
  index: NameIndex,
  categories: ArtifactCategory[]
): Array<{ urn: string; entry: NameIndexEntry }> {
  return Object.entries(index.entries)
    .filter(([_, entry]) => categories.includes(entry.category))
    .map(([urn, entry]) => ({ urn, entry }));
}

/**
 * Search display names (O(n) scan of index, not files)
 */
export function searchDisplayNames(
  index: NameIndex,
  searchTerm: string
): Array<{ urn: string; entry: NameIndexEntry }> {
  const term = searchTerm.toLowerCase();
  return Object.entries(index.entries)
    .filter(([urn, entry]) =>
      entry.displayName.toLowerCase().includes(term) ||
      urn.toLowerCase().includes(term)
    )
    .map(([urn, entry]) => ({ urn, entry }));
}

/**
 * Get all URNs in the index
 */
export function getAllUrns(index: NameIndex): string[] {
  return Object.keys(index.entries);
}

/**
 * Get all relationship URNs in the index
 */
export function getAllRelationshipUrns(index: RelationshipIndex): string[] {
  return Object.keys(index.entries);
}

/**
 * Get index statistics
 */
export function getIndexStats(
  nameIndex: NameIndex,
  relIndex: RelationshipIndex
): {
  totalArtifacts: number;
  totalRelationships: number;
  byCategory: Record<string, number>;
  byRelType: Record<string, number>;
} {
  const byCategory: Record<string, number> = {};
  const byRelType: Record<string, number> = {};

  for (const entry of Object.values(nameIndex.entries)) {
    byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
  }

  for (const entry of Object.values(relIndex.entries)) {
    byRelType[entry.type] = (byRelType[entry.type] || 0) + 1;
  }

  return {
    totalArtifacts: Object.keys(nameIndex.entries).length,
    totalRelationships: Object.keys(relIndex.entries).length,
    byCategory,
    byRelType
  };
}

/**
 * Migrate name index from older version
 */
function migrateNameIndex(oldIndex: NameIndex): NameIndex {
  // For now, just update version
  return {
    ...oldIndex,
    version: INDEX_VERSION,
    lastRebuilt: new Date().toISOString()
  };
}

/**
 * Migrate relationship index from older version
 */
function migrateRelationshipIndex(oldIndex: RelationshipIndex): RelationshipIndex {
  // For now, just update version
  return {
    ...oldIndex,
    version: INDEX_VERSION,
    lastRebuilt: new Date().toISOString()
  };
}

/**
 * Verify index integrity against actual files
 * Returns list of issues found
 */
export async function verifyIndexIntegrity(
  fs: FileSystemAdapter,
  basePath: string,
  nameIndex: NameIndex
): Promise<string[]> {
  const issues: string[] = [];

  // Check each indexed file exists
  for (const [urn, entry] of Object.entries(nameIndex.entries)) {
    const filePath = `${basePath}/${entry.filePath}`;
    const exists = await fs.exists(filePath);
    if (!exists) {
      issues.push(`Missing file for URN ${urn}: ${entry.filePath}`);
    }
  }

  return issues;
}

/**
 * Rebuild indexes by scanning all artifact files
 * Used for recovery or initial setup
 */
export async function rebuildIndexes(
  fs: FileSystemAdapter,
  basePath: string,
  listFiles: (dir: string) => Promise<string[]>,
  readArtifact: (path: string) => Promise<Artifact>,
  readRelationship: (path: string) => Promise<ArtifactRelationship>
): Promise<{ nameIndex: NameIndex; relIndex: RelationshipIndex }> {
  const nameIndex = createNameIndex();
  const relIndex = createRelationshipIndex();

  // Scan artifacts directory
  const artifactsDir = `${basePath}/artifacts`;
  try {
    const categories = await listFiles(artifactsDir);
    for (const category of categories) {
      const categoryDir = `${artifactsDir}/${category}`;
      const files = await listFiles(categoryDir);

      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        try {
          const filePath = `artifacts/${category}/${file}`;
          const artifact = await readArtifact(`${basePath}/${filePath}`);
          indexArtifact(nameIndex, artifact, filePath);
        } catch (e) {
          // Skip invalid files
          console.warn(`Failed to read artifact ${file}:`, e);
        }
      }
    }
  } catch {
    // artifacts directory doesn't exist yet
  }

  // Scan relationships directory
  const relsDir = `${basePath}/relationships`;
  try {
    const files = await listFiles(relsDir);

    for (const file of files) {
      if (!file.endsWith('.md')) continue;

      try {
        const filePath = `relationships/${file}`;
        const rel = await readRelationship(`${basePath}/${filePath}`);
        indexRelationship(relIndex, rel, filePath);
      } catch (e) {
        // Skip invalid files
        console.warn(`Failed to read relationship ${file}:`, e);
      }
    }
  } catch {
    // relationships directory doesn't exist yet
  }

  nameIndex.lastRebuilt = new Date().toISOString();
  relIndex.lastRebuilt = new Date().toISOString();

  return { nameIndex, relIndex };
}
