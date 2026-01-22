/**
 * File Persistence
 *
 * Handles file-per-artifact storage operations. Each artifact is stored
 * as an individual markdown file with YAML frontmatter.
 *
 * Directory Structure:
 * .architecture/
 * ├── registry.json              # Metadata only
 * ├── .name-index.json           # URN → file path mapping
 * ├── .rel-index.json            # Relationship indexes
 * ├── artifacts/
 * │   ├── system/
 * │   ├── container/
 * │   ├── component/
 * │   └── code/
 * └── relationships/
 */

import type { FileSystemAdapter, ExtendedFileSystemAdapter } from './artifact-persistence.js';
import type {
  Artifact,
  ArtifactRelationship,
  ArtifactRegistry,
  RegistryMetadata,
  NameIndex,
  RelationshipIndex,
  ArtifactCategory
} from '../types/artifacts.js';
import {
  serializeArtifact,
  deserializeArtifact,
  serializeRelationship,
  deserializeRelationship,
  generateArtifactFilePath,
  generateRelationshipFilePath
} from './markdown-serializer.js';
import {
  loadNameIndex,
  saveNameIndex,
  loadRelationshipIndex,
  saveRelationshipIndex,
  indexArtifact,
  unindexArtifact,
  indexRelationship,
  unindexRelationship,
  lookupArtifact,
  lookupRelationship,
  createNameIndex,
  createRelationshipIndex
} from './index-manager.js';
import { SCHEMA_VERSION } from './artifact-registry.js';

/** Storage version for file-per-artifact format */
export const STORAGE_VERSION = '2.0.0';

/** Directory names */
export const ARTIFACTS_DIR = '.architecture';
export const REGISTRY_FILE = 'registry.json';

/** Category directories */
const CATEGORY_DIRS: ArtifactCategory[] = [
  'person', 'system', 'container', 'component',
  'code', 'archimate', 'relationship', 'external'
];


/**
 * Check if storage is file-per-artifact format
 */
export async function isFilePerArtifactFormat(
  fs: FileSystemAdapter,
  projectRoot: string
): Promise<boolean> {
  const registryPath = `${projectRoot}/${ARTIFACTS_DIR}/${REGISTRY_FILE}`;

  try {
    const exists = await fs.exists(registryPath);
    if (!exists) return false;

    const content = await fs.readFile(registryPath);
    const metadata = JSON.parse(content) as RegistryMetadata;

    return metadata.storageVersion === STORAGE_VERSION;
  } catch {
    return false;
  }
}

/**
 * Check if storage is legacy single-file format
 */
export async function isLegacyFormat(
  fs: FileSystemAdapter,
  projectRoot: string
): Promise<boolean> {
  const legacyPath = `${projectRoot}/${ARTIFACTS_DIR}/artifacts.json`;

  try {
    const exists = await fs.exists(legacyPath);
    return exists;
  } catch {
    return false;
  }
}

/**
 * Initialize file-per-artifact directory structure
 */
export async function initializeStorage(
  fs: FileSystemAdapter,
  projectRoot: string,
  registryId: string,
  registryName: string,
  repository?: string
): Promise<void> {
  const basePath = `${projectRoot}/${ARTIFACTS_DIR}`;

  // Create base directory
  await ensureDir(fs, basePath);

  // Create artifacts subdirectories
  const artifactsDir = `${basePath}/artifacts`;
  await ensureDir(fs, artifactsDir);

  for (const category of CATEGORY_DIRS) {
    await ensureDir(fs, `${artifactsDir}/${category}`);
  }

  // Create relationships directory
  await ensureDir(fs, `${basePath}/relationships`);

  // Create registry metadata
  const metadata: RegistryMetadata = {
    id: registryId,
    name: registryName,
    repository,
    schemaVersion: SCHEMA_VERSION,
    storageVersion: STORAGE_VERSION,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    artifactCount: 0,
    relationshipCount: 0
  };

  await fs.writeFile(
    `${basePath}/${REGISTRY_FILE}`,
    JSON.stringify(metadata, null, 2)
  );

  // Create empty indexes
  await saveNameIndex(fs, basePath, createNameIndex());
  await saveRelationshipIndex(fs, basePath, createRelationshipIndex());
}

/**
 * Load registry metadata
 */
export async function loadRegistryMetadata(
  fs: FileSystemAdapter,
  projectRoot: string
): Promise<RegistryMetadata | null> {
  const metadataPath = `${projectRoot}/${ARTIFACTS_DIR}/${REGISTRY_FILE}`;

  try {
    const exists = await fs.exists(metadataPath);
    if (!exists) return null;

    const content = await fs.readFile(metadataPath);
    return JSON.parse(content) as RegistryMetadata;
  } catch {
    return null;
  }
}

/**
 * Save registry metadata
 */
export async function saveRegistryMetadata(
  fs: FileSystemAdapter,
  projectRoot: string,
  metadata: RegistryMetadata
): Promise<void> {
  const metadataPath = `${projectRoot}/${ARTIFACTS_DIR}/${REGISTRY_FILE}`;
  metadata.updatedAt = new Date().toISOString();
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
}

/**
 * Save a single artifact to file
 */
export async function saveArtifact(
  fs: FileSystemAdapter,
  projectRoot: string,
  artifact: Artifact,
  nameIndex: NameIndex
): Promise<string> {
  const basePath = `${projectRoot}/${ARTIFACTS_DIR}`;
  const filePath = generateArtifactFilePath(artifact);
  const fullPath = `${basePath}/${filePath}`;

  // Ensure category directory exists
  const categoryDir = `${basePath}/artifacts/${artifact.category}`;
  await ensureDir(fs, categoryDir);

  // Serialize and write
  const content = serializeArtifact(artifact);
  await fs.writeFile(fullPath, content);

  // Update index
  indexArtifact(nameIndex, artifact, filePath);

  return filePath;
}

/**
 * Load a single artifact by URN using the index
 */
export async function loadArtifactByUrn(
  fs: FileSystemAdapter,
  projectRoot: string,
  urn: string,
  nameIndex: NameIndex
): Promise<Artifact | null> {
  const entry = lookupArtifact(nameIndex, urn);
  if (!entry) return null;

  const fullPath = `${projectRoot}/${ARTIFACTS_DIR}/${entry.filePath}`;

  try {
    const content = await fs.readFile(fullPath);
    return deserializeArtifact(content);
  } catch {
    return null;
  }
}

/**
 * Load artifact from file path
 */
export async function loadArtifactFromFile(
  fs: FileSystemAdapter,
  filePath: string
): Promise<Artifact> {
  const content = await fs.readFile(filePath);
  return deserializeArtifact(content);
}

/**
 * Delete an artifact
 */
export async function deleteArtifact(
  fs: ExtendedFileSystemAdapter,
  projectRoot: string,
  urn: string,
  nameIndex: NameIndex
): Promise<boolean> {
  const entry = lookupArtifact(nameIndex, urn);
  if (!entry) return false;

  const fullPath = `${projectRoot}/${ARTIFACTS_DIR}/${entry.filePath}`;

  try {
    await fs.deleteFile(fullPath);
    unindexArtifact(nameIndex, urn);
    return true;
  } catch {
    return false;
  }
}

/**
 * Save a relationship to file
 */
export async function saveRelationship(
  fs: FileSystemAdapter,
  projectRoot: string,
  rel: ArtifactRelationship,
  relIndex: RelationshipIndex
): Promise<string> {
  const basePath = `${projectRoot}/${ARTIFACTS_DIR}`;
  const filePath = generateRelationshipFilePath(rel);
  const fullPath = `${basePath}/${filePath}`;

  // Ensure relationships directory exists
  await ensureDir(fs, `${basePath}/relationships`);

  // Serialize and write
  const content = serializeRelationship(rel);
  await fs.writeFile(fullPath, content);

  // Update index
  indexRelationship(relIndex, rel, filePath);

  return filePath;
}

/**
 * Load a relationship by URN using the index
 */
export async function loadRelationshipByUrn(
  fs: FileSystemAdapter,
  projectRoot: string,
  urn: string,
  relIndex: RelationshipIndex
): Promise<ArtifactRelationship | null> {
  const entry = lookupRelationship(relIndex, urn);
  if (!entry) return null;

  const fullPath = `${projectRoot}/${ARTIFACTS_DIR}/${entry.filePath}`;

  try {
    const content = await fs.readFile(fullPath);
    return deserializeRelationship(content);
  } catch {
    return null;
  }
}

/**
 * Load relationship from file path
 */
export async function loadRelationshipFromFile(
  fs: FileSystemAdapter,
  filePath: string
): Promise<ArtifactRelationship> {
  const content = await fs.readFile(filePath);
  return deserializeRelationship(content);
}

/**
 * Delete a relationship
 */
export async function deleteRelationship(
  fs: ExtendedFileSystemAdapter,
  projectRoot: string,
  rel: ArtifactRelationship,
  relIndex: RelationshipIndex
): Promise<boolean> {
  const entry = lookupRelationship(relIndex, rel.urn);
  if (!entry) return false;

  const fullPath = `${projectRoot}/${ARTIFACTS_DIR}/${entry.filePath}`;

  try {
    await fs.deleteFile(fullPath);
    unindexRelationship(relIndex, rel);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load all artifacts (for full registry load)
 * Uses lazy loading - only loads metadata from index, full artifacts on demand
 */
export async function loadAllArtifacts(
  fs: FileSystemAdapter,
  projectRoot: string,
  nameIndex: NameIndex
): Promise<Map<string, Artifact>> {
  const artifacts = new Map<string, Artifact>();
  const basePath = `${projectRoot}/${ARTIFACTS_DIR}`;

  for (const [urn, entry] of Object.entries(nameIndex.entries)) {
    const fullPath = `${basePath}/${entry.filePath}`;

    try {
      const content = await fs.readFile(fullPath);
      const artifact = deserializeArtifact(content);
      artifacts.set(urn, artifact);
    } catch {
      // Skip files that can't be read
      console.warn(`Failed to load artifact: ${entry.filePath}`);
    }
  }

  return artifacts;
}

/**
 * Load all relationships
 */
export async function loadAllRelationships(
  fs: FileSystemAdapter,
  projectRoot: string,
  relIndex: RelationshipIndex
): Promise<Map<string, ArtifactRelationship>> {
  const relationships = new Map<string, ArtifactRelationship>();
  const basePath = `${projectRoot}/${ARTIFACTS_DIR}`;

  for (const [urn, entry] of Object.entries(relIndex.entries)) {
    const fullPath = `${basePath}/${entry.filePath}`;

    try {
      const content = await fs.readFile(fullPath);
      const rel = deserializeRelationship(content);
      relationships.set(urn, rel);
    } catch {
      // Skip files that can't be read
      console.warn(`Failed to load relationship: ${entry.filePath}`);
    }
  }

  return relationships;
}

/**
 * Save all artifacts and relationships (batch save)
 */
export async function saveAllArtifacts(
  fs: FileSystemAdapter,
  projectRoot: string,
  registry: ArtifactRegistry
): Promise<{ nameIndex: NameIndex; relIndex: RelationshipIndex }> {
  const nameIndex = createNameIndex();
  const relIndex = createRelationshipIndex();

  // Save all artifacts
  for (const artifact of registry.artifacts.values()) {
    await saveArtifact(fs, projectRoot, artifact, nameIndex);
  }

  // Save all relationships
  for (const rel of registry.relationships.values()) {
    await saveRelationship(fs, projectRoot, rel, relIndex);
  }

  // Save indexes
  const basePath = `${projectRoot}/${ARTIFACTS_DIR}`;
  await saveNameIndex(fs, basePath, nameIndex);
  await saveRelationshipIndex(fs, basePath, relIndex);

  // Update metadata
  const metadata = await loadRegistryMetadata(fs, projectRoot);
  if (metadata) {
    metadata.artifactCount = registry.artifacts.size;
    metadata.relationshipCount = registry.relationships.size;
    await saveRegistryMetadata(fs, projectRoot, metadata);
  }

  return { nameIndex, relIndex };
}

/**
 * Ensure directory exists
 */
async function ensureDir(fs: FileSystemAdapter, path: string): Promise<void> {
  const exists = await fs.exists(path);
  if (!exists) {
    await fs.mkdir(path);
  }
}

/**
 * Create file-per-artifact storage manager
 */
export function createFileStorage(
  fs: ExtendedFileSystemAdapter,
  projectRoot: string
) {
  let nameIndex: NameIndex | null = null;
  let relIndex: RelationshipIndex | null = null;
  let metadata: RegistryMetadata | null = null;

  const basePath = `${projectRoot}/${ARTIFACTS_DIR}`;

  return {
    /**
     * Initialize storage (creates directories and files)
     */
    async initialize(id: string, name: string, repository?: string): Promise<void> {
      await initializeStorage(fs, projectRoot, id, name, repository);
      nameIndex = await loadNameIndex(fs, basePath);
      relIndex = await loadRelationshipIndex(fs, basePath);
      metadata = await loadRegistryMetadata(fs, projectRoot);
    },

    /**
     * Load indexes (for existing storage)
     */
    async load(): Promise<void> {
      nameIndex = await loadNameIndex(fs, basePath);
      relIndex = await loadRelationshipIndex(fs, basePath);
      metadata = await loadRegistryMetadata(fs, projectRoot);
    },

    /**
     * Get metadata
     */
    getMetadata(): RegistryMetadata | null {
      return metadata;
    },

    /**
     * Get name index
     */
    getNameIndex(): NameIndex {
      if (!nameIndex) throw new Error('Storage not loaded');
      return nameIndex;
    },

    /**
     * Get relationship index
     */
    getRelationshipIndex(): RelationshipIndex {
      if (!relIndex) throw new Error('Storage not loaded');
      return relIndex;
    },

    /**
     * Save artifact
     */
    async saveArtifact(artifact: Artifact): Promise<void> {
      if (!nameIndex) throw new Error('Storage not loaded');
      await saveArtifact(fs, projectRoot, artifact, nameIndex);
      await saveNameIndex(fs, basePath, nameIndex);

      if (metadata) {
        metadata.artifactCount = Object.keys(nameIndex.entries).length;
        await saveRegistryMetadata(fs, projectRoot, metadata);
      }
    },

    /**
     * Load artifact by URN
     */
    async loadArtifact(urn: string): Promise<Artifact | null> {
      if (!nameIndex) throw new Error('Storage not loaded');
      return loadArtifactByUrn(fs, projectRoot, urn, nameIndex);
    },

    /**
     * Delete artifact
     */
    async deleteArtifact(urn: string): Promise<boolean> {
      if (!nameIndex) throw new Error('Storage not loaded');
      const result = await deleteArtifact(fs, projectRoot, urn, nameIndex);

      if (result) {
        await saveNameIndex(fs, basePath, nameIndex);
        if (metadata) {
          metadata.artifactCount = Object.keys(nameIndex.entries).length;
          await saveRegistryMetadata(fs, projectRoot, metadata);
        }
      }

      return result;
    },

    /**
     * Save relationship
     */
    async saveRelationship(rel: ArtifactRelationship): Promise<void> {
      if (!relIndex) throw new Error('Storage not loaded');
      await saveRelationship(fs, projectRoot, rel, relIndex);
      await saveRelationshipIndex(fs, basePath, relIndex);

      if (metadata) {
        metadata.relationshipCount = Object.keys(relIndex.entries).length;
        await saveRegistryMetadata(fs, projectRoot, metadata);
      }
    },

    /**
     * Load relationship by URN
     */
    async loadRelationship(urn: string): Promise<ArtifactRelationship | null> {
      if (!relIndex) throw new Error('Storage not loaded');
      return loadRelationshipByUrn(fs, projectRoot, urn, relIndex);
    },

    /**
     * Delete relationship
     */
    async deleteRelationship(rel: ArtifactRelationship): Promise<boolean> {
      if (!relIndex) throw new Error('Storage not loaded');
      const result = await deleteRelationship(fs, projectRoot, rel, relIndex);

      if (result) {
        await saveRelationshipIndex(fs, basePath, relIndex);
        if (metadata) {
          metadata.relationshipCount = Object.keys(relIndex.entries).length;
          await saveRegistryMetadata(fs, projectRoot, metadata);
        }
      }

      return result;
    },

    /**
     * Load all artifacts
     */
    async loadAllArtifacts(): Promise<Map<string, Artifact>> {
      if (!nameIndex) throw new Error('Storage not loaded');
      return loadAllArtifacts(fs, projectRoot, nameIndex);
    },

    /**
     * Load all relationships
     */
    async loadAllRelationships(): Promise<Map<string, ArtifactRelationship>> {
      if (!relIndex) throw new Error('Storage not loaded');
      return loadAllRelationships(fs, projectRoot, relIndex);
    },

    /**
     * Flush indexes to disk
     */
    async flush(): Promise<void> {
      if (nameIndex) await saveNameIndex(fs, basePath, nameIndex);
      if (relIndex) await saveRelationshipIndex(fs, basePath, relIndex);
      if (metadata) await saveRegistryMetadata(fs, projectRoot, metadata);
    }
  };
}

export type FileStorage = ReturnType<typeof createFileStorage>;
