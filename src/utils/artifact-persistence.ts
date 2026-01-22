/**
 * Artifact Registry Persistence
 *
 * Handles saving and loading artifact registries to/from files.
 * Supports two storage formats:
 * - Legacy: Single artifacts.json file
 * - File-per-artifact: Individual markdown files with YAML frontmatter
 *
 * The module auto-detects format on load and provides migration utilities.
 */

import type { ArtifactRegistry, ArtifactRegistryData, NameIndex, RelationshipIndex, RegistryMetadata } from '../types/artifacts.js';
import { createRegistry, serializeRegistry, deserializeRegistry, SCHEMA_VERSION } from './artifact-registry.js';
import {
  isFilePerArtifactFormat,
  isLegacyFormat,
  initializeStorage,
  loadRegistryMetadata,
  loadAllArtifacts,
  loadAllRelationships,
  saveAllArtifacts,
  ARTIFACTS_DIR,
  STORAGE_VERSION
} from './file-persistence.js';
import {
  loadNameIndex,
  loadRelationshipIndex,
  saveNameIndex,
  saveRelationshipIndex
} from './index-manager.js';

/** Default directory for architecture artifacts */
export { ARTIFACTS_DIR };

/** Default artifacts file name (legacy format) */
export const ARTIFACTS_FILE = 'artifacts.json';

/** Default full path (legacy format) */
export const DEFAULT_ARTIFACTS_PATH = `${ARTIFACTS_DIR}/${ARTIFACTS_FILE}`;

/**
 * File system interface for persistence operations
 * This allows the module to work with different file systems
 */
export interface FileSystemAdapter {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
}

/**
 * Extended file system adapter with additional operations
 */
export interface ExtendedFileSystemAdapter extends FileSystemAdapter {
  listDir(path: string): Promise<string[]>;
  deleteFile(path: string): Promise<void>;
}

/**
 * Storage format detection result
 */
export type StorageFormat = 'legacy' | 'file-per-artifact' | 'none';

/**
 * Detect the storage format used
 */
export async function detectStorageFormat(
  fs: FileSystemAdapter,
  projectRoot: string
): Promise<StorageFormat> {
  // Check for new format first
  if (await isFilePerArtifactFormat(fs, projectRoot)) {
    return 'file-per-artifact';
  }

  // Check for legacy format
  if (await isLegacyFormat(fs, projectRoot)) {
    return 'legacy';
  }

  return 'none';
}

/**
 * Load registry from file (auto-detects format)
 */
export async function loadRegistry(
  fs: FileSystemAdapter,
  projectRoot: string,
  registryPath: string = DEFAULT_ARTIFACTS_PATH
): Promise<ArtifactRegistry> {
  const format = await detectStorageFormat(fs, projectRoot);

  switch (format) {
    case 'file-per-artifact':
      return loadFilePerArtifactRegistry(fs, projectRoot);

    case 'legacy':
      return loadLegacyRegistry(fs, projectRoot, registryPath);

    case 'none':
    default:
      // Create new registry based on project
      const projectName = projectRoot.split('/').pop() || 'unknown';
      return createRegistry(projectName, projectName);
  }
}

/**
 * Load registry from legacy single-file format
 */
async function loadLegacyRegistry(
  fs: FileSystemAdapter,
  projectRoot: string,
  registryPath: string
): Promise<ArtifactRegistry> {
  const fullPath = `${projectRoot}/${registryPath}`;

  try {
    const content = await fs.readFile(fullPath);
    const data: ArtifactRegistryData = JSON.parse(content);

    // Check schema version and migrate if needed
    if (data.schemaVersion !== SCHEMA_VERSION) {
      return migrateLegacyRegistry(data);
    }

    return deserializeRegistry(data);
  } catch (error) {
    // If file doesn't exist or is invalid, create new registry
    const projectName = projectRoot.split('/').pop() || 'unknown';
    return createRegistry(projectName, projectName);
  }
}

/**
 * Load registry from file-per-artifact format
 */
async function loadFilePerArtifactRegistry(
  fs: FileSystemAdapter,
  projectRoot: string
): Promise<ArtifactRegistry> {
  const basePath = `${projectRoot}/${ARTIFACTS_DIR}`;

  // Load metadata
  const metadata = await loadRegistryMetadata(fs, projectRoot);
  if (!metadata) {
    const projectName = projectRoot.split('/').pop() || 'unknown';
    return createRegistry(projectName, projectName);
  }

  // Load indexes
  const nameIndex = await loadNameIndex(fs, basePath);
  const relIndex = await loadRelationshipIndex(fs, basePath);

  // Load all artifacts and relationships
  const artifacts = await loadAllArtifacts(fs, projectRoot, nameIndex);
  const relationships = await loadAllRelationships(fs, projectRoot, relIndex);

  return {
    id: metadata.id,
    name: metadata.name,
    repository: metadata.repository,
    artifacts,
    relationships,
    schemaVersion: metadata.schemaVersion,
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt
  };
}

/**
 * Save registry to file (uses file-per-artifact format)
 */
export async function saveRegistry(
  fs: FileSystemAdapter,
  projectRoot: string,
  registry: ArtifactRegistry,
  registryPath: string = DEFAULT_ARTIFACTS_PATH
): Promise<void> {
  const format = await detectStorageFormat(fs, projectRoot);

  // If legacy format exists, use legacy save to avoid breaking existing workflows
  // Users should explicitly migrate to new format
  if (format === 'legacy') {
    await saveLegacyRegistry(fs, projectRoot, registry, registryPath);
    return;
  }

  // Use file-per-artifact format
  await saveFilePerArtifactRegistry(fs, projectRoot, registry);
}

/**
 * Save registry using legacy single-file format
 */
async function saveLegacyRegistry(
  fs: FileSystemAdapter,
  projectRoot: string,
  registry: ArtifactRegistry,
  registryPath: string
): Promise<void> {
  const fullPath = `${projectRoot}/${registryPath}`;
  const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'));

  // Ensure directory exists
  const dirExists = await fs.exists(dirPath);
  if (!dirExists) {
    await fs.mkdir(dirPath);
  }

  const data = serializeRegistry(registry);
  const content = JSON.stringify(data, null, 2);
  await fs.writeFile(fullPath, content);
}

/**
 * Save registry using file-per-artifact format
 */
async function saveFilePerArtifactRegistry(
  fs: FileSystemAdapter,
  projectRoot: string,
  registry: ArtifactRegistry
): Promise<void> {
  const basePath = `${projectRoot}/${ARTIFACTS_DIR}`;

  // Check if storage is initialized
  const metadata = await loadRegistryMetadata(fs, projectRoot);
  if (!metadata) {
    // Initialize storage first
    await initializeStorage(fs, projectRoot, registry.id, registry.name, registry.repository);
  }

  // Save all artifacts and relationships, get updated indexes
  await saveAllArtifacts(fs, projectRoot, registry);
}

/**
 * Save registry to file-per-artifact format (explicit)
 * Use this when you want to ensure the new format is used
 */
export async function saveRegistryAsFilePerArtifact(
  fs: FileSystemAdapter,
  projectRoot: string,
  registry: ArtifactRegistry
): Promise<{ nameIndex: NameIndex; relIndex: RelationshipIndex }> {
  const basePath = `${projectRoot}/${ARTIFACTS_DIR}`;

  // Initialize storage if needed
  const metadata = await loadRegistryMetadata(fs, projectRoot);
  if (!metadata) {
    await initializeStorage(fs, projectRoot, registry.id, registry.name, registry.repository);
  }

  // Save all artifacts and relationships
  return saveAllArtifacts(fs, projectRoot, registry);
}

/**
 * Migrate registry from older schema versions
 */
function migrateLegacyRegistry(data: ArtifactRegistryData): ArtifactRegistry {
  // For now, just update the schema version
  // Future versions can add migration logic here
  const migrated: ArtifactRegistryData = {
    ...data,
    schemaVersion: SCHEMA_VERSION
  };

  return deserializeRegistry(migrated);
}

/**
 * Export registry to different formats
 */
export function exportRegistryToMarkdown(registry: ArtifactRegistry): string {
  const lines: string[] = [
    `# Architecture Artifacts: ${registry.name}`,
    '',
    `> Repository: ${registry.repository || 'N/A'}`,
    `> Last Updated: ${registry.updatedAt}`,
    '',
    '## Summary',
    '',
    `- **Total Artifacts**: ${registry.artifacts.size}`,
    `- **Total Relationships**: ${registry.relationships.size}`,
    ''
  ];

  // Group artifacts by category
  const byCategory = new Map<string, typeof registry.artifacts extends Map<string, infer V> ? V[] : never>();
  for (const artifact of registry.artifacts.values()) {
    const list = byCategory.get(artifact.category) || [];
    list.push(artifact);
    byCategory.set(artifact.category, list);
  }

  // Output each category
  for (const [category, artifacts] of byCategory) {
    lines.push(`## ${formatCategoryName(category)} (${artifacts.length})`);
    lines.push('');
    lines.push('| URN | Name | Technology | Source |');
    lines.push('|-----|------|------------|--------|');

    for (const artifact of artifacts) {
      const source = artifact.source?.filePath || '-';
      lines.push(`| \`${artifact.urn}\` | ${artifact.displayName} | ${artifact.technology || '-'} | ${source} |`);
    }
    lines.push('');
  }

  // Output relationships
  if (registry.relationships.size > 0) {
    lines.push('## Relationships');
    lines.push('');
    lines.push('| Source | Type | Target | Label |');
    lines.push('|--------|------|--------|-------|');

    for (const rel of registry.relationships.values()) {
      const sourceArtifact = registry.artifacts.get(rel.sourceUrn);
      const targetArtifact = registry.artifacts.get(rel.targetUrn);
      const sourceName = sourceArtifact?.displayName || rel.sourceUrn;
      const targetName = targetArtifact?.displayName || rel.targetUrn;
      lines.push(`| ${sourceName} | ${rel.type} | ${targetName} | ${rel.label || '-'} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format category name for display
 */
function formatCategoryName(category: string): string {
  return category
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Generate .gitignore content for architecture directory
 */
export function generateGitignoreContent(): string {
  return `# Architecture artifacts are typically project-specific
# Uncomment to ignore:
# artifacts.json
# artifacts/
# relationships/

# Index files are auto-generated and can be rebuilt
# .name-index.json
# .rel-index.json

# Always ignore temporary files
*.tmp
*.bak
`;
}

/**
 * Get storage information
 */
export async function getStorageInfo(
  fs: FileSystemAdapter,
  projectRoot: string
): Promise<{
  format: StorageFormat;
  metadata?: RegistryMetadata;
  artifactCount: number;
  relationshipCount: number;
}> {
  const format = await detectStorageFormat(fs, projectRoot);

  if (format === 'file-per-artifact') {
    const metadata = await loadRegistryMetadata(fs, projectRoot);
    return {
      format,
      metadata: metadata || undefined,
      artifactCount: metadata?.artifactCount || 0,
      relationshipCount: metadata?.relationshipCount || 0
    };
  }

  if (format === 'legacy') {
    const fullPath = `${projectRoot}/${DEFAULT_ARTIFACTS_PATH}`;
    try {
      const content = await fs.readFile(fullPath);
      const data: ArtifactRegistryData = JSON.parse(content);
      return {
        format,
        artifactCount: Object.keys(data.artifacts).length,
        relationshipCount: Object.keys(data.relationships).length
      };
    } catch {
      return { format, artifactCount: 0, relationshipCount: 0 };
    }
  }

  return { format: 'none', artifactCount: 0, relationshipCount: 0 };
}
