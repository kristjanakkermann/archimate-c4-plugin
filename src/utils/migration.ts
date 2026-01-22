/**
 * Migration Utilities
 *
 * Handles migration from legacy artifacts.json format to file-per-artifact format.
 * Provides backup, conversion, and verification functionality.
 */

import type {
  ArtifactRegistry,
  ArtifactRegistryData,
  NameIndex,
  RelationshipIndex
} from '../types/artifacts.js';
import type { FileSystemAdapter, ExtendedFileSystemAdapter, StorageFormat } from './artifact-persistence.js';
import { deserializeRegistry } from './artifact-registry.js';
import {
  detectStorageFormat,
  ARTIFACTS_DIR,
  DEFAULT_ARTIFACTS_PATH
} from './artifact-persistence.js';
import {
  initializeStorage,
  saveAllArtifacts,
  loadAllArtifacts,
  loadAllRelationships
} from './file-persistence.js';
import {
  loadNameIndex,
  loadRelationshipIndex
} from './index-manager.js';

/**
 * Migration result
 */
export interface MigrationResult {
  success: boolean;
  format: {
    from: StorageFormat;
    to: StorageFormat;
  };
  stats: {
    artifactsMigrated: number;
    relationshipsMigrated: number;
    backupPath?: string;
  };
  errors: string[];
  warnings: string[];
}

/**
 * Migration options
 */
export interface MigrationOptions {
  /** Create backup of old format before migrating */
  createBackup?: boolean;
  /** Backup file name (defaults to artifacts.json.backup.{timestamp}) */
  backupFileName?: string;
  /** Delete old format files after successful migration */
  deleteOldFormat?: boolean;
  /** Verify migration by comparing counts */
  verify?: boolean;
  /** Dry run - don't actually write files */
  dryRun?: boolean;
}

/**
 * Check if migration is needed
 */
export async function isMigrationNeeded(
  fs: FileSystemAdapter,
  projectRoot: string
): Promise<boolean> {
  const format = await detectStorageFormat(fs, projectRoot);
  return format === 'legacy';
}

/**
 * Get migration preview without actually migrating
 */
export async function getMigrationPreview(
  fs: FileSystemAdapter,
  projectRoot: string
): Promise<{
  currentFormat: StorageFormat;
  artifactCount: number;
  relationshipCount: number;
  estimatedFiles: number;
  canMigrate: boolean;
  reason?: string;
}> {
  const format = await detectStorageFormat(fs, projectRoot);

  if (format === 'none') {
    return {
      currentFormat: 'none',
      artifactCount: 0,
      relationshipCount: 0,
      estimatedFiles: 0,
      canMigrate: false,
      reason: 'No registry found'
    };
  }

  if (format === 'file-per-artifact') {
    return {
      currentFormat: 'file-per-artifact',
      artifactCount: 0,
      relationshipCount: 0,
      estimatedFiles: 0,
      canMigrate: false,
      reason: 'Already using file-per-artifact format'
    };
  }

  // Load legacy format to get counts
  const legacyPath = `${projectRoot}/${DEFAULT_ARTIFACTS_PATH}`;
  try {
    const content = await fs.readFile(legacyPath);
    const data: ArtifactRegistryData = JSON.parse(content);
    const artifactCount = Object.keys(data.artifacts).length;
    const relationshipCount = Object.keys(data.relationships).length;

    return {
      currentFormat: 'legacy',
      artifactCount,
      relationshipCount,
      estimatedFiles: artifactCount + relationshipCount + 3, // +3 for registry.json, indexes
      canMigrate: true
    };
  } catch (error) {
    return {
      currentFormat: 'legacy',
      artifactCount: 0,
      relationshipCount: 0,
      estimatedFiles: 0,
      canMigrate: false,
      reason: `Failed to read legacy format: ${error}`
    };
  }
}

/**
 * Migrate from legacy format to file-per-artifact format
 */
export async function migrateToFilePerArtifact(
  fs: FileSystemAdapter,
  projectRoot: string,
  options: MigrationOptions = {}
): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    format: { from: 'legacy', to: 'file-per-artifact' },
    stats: {
      artifactsMigrated: 0,
      relationshipsMigrated: 0
    },
    errors: [],
    warnings: []
  };

  // Check current format
  const currentFormat = await detectStorageFormat(fs, projectRoot);
  result.format.from = currentFormat;

  if (currentFormat === 'none') {
    result.errors.push('No registry found to migrate');
    return result;
  }

  if (currentFormat === 'file-per-artifact') {
    result.warnings.push('Already using file-per-artifact format');
    result.success = true;
    result.format.to = 'file-per-artifact';
    return result;
  }

  // Load legacy registry
  const legacyPath = `${projectRoot}/${DEFAULT_ARTIFACTS_PATH}`;
  let registry: ArtifactRegistry;

  try {
    const content = await fs.readFile(legacyPath);
    const data: ArtifactRegistryData = JSON.parse(content);
    registry = deserializeRegistry(data);
  } catch (error) {
    result.errors.push(`Failed to load legacy registry: ${error}`);
    return result;
  }

  // Create backup if requested
  if (options.createBackup && !options.dryRun) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = options.backupFileName || `artifacts.json.backup.${timestamp}`;
      const backupPath = `${projectRoot}/${ARTIFACTS_DIR}/${backupFileName}`;

      const content = await fs.readFile(legacyPath);
      await fs.writeFile(backupPath, content);
      result.stats.backupPath = backupPath;
    } catch (error) {
      result.warnings.push(`Failed to create backup: ${error}`);
    }
  }

  if (options.dryRun) {
    result.success = true;
    result.stats.artifactsMigrated = registry.artifacts.size;
    result.stats.relationshipsMigrated = registry.relationships.size;
    result.warnings.push('Dry run - no files were written');
    return result;
  }

  // Initialize new storage format
  try {
    await initializeStorage(
      fs,
      projectRoot,
      registry.id,
      registry.name,
      registry.repository
    );
  } catch (error) {
    result.errors.push(`Failed to initialize storage: ${error}`);
    return result;
  }

  // Save all artifacts and relationships in new format
  try {
    const { nameIndex, relIndex } = await saveAllArtifacts(fs, projectRoot, registry);
    result.stats.artifactsMigrated = Object.keys(nameIndex.entries).length;
    result.stats.relationshipsMigrated = Object.keys(relIndex.entries).length;
  } catch (error) {
    result.errors.push(`Failed to save artifacts: ${error}`);
    return result;
  }

  // Verify migration if requested
  if (options.verify) {
    const verifyResult = await verifyMigration(fs, projectRoot, registry);
    if (!verifyResult.success) {
      result.errors.push(...verifyResult.errors);
      result.warnings.push(...verifyResult.warnings);
      return result;
    }
  }

  // Delete old format files if requested
  if (options.deleteOldFormat) {
    const extFs = fs as ExtendedFileSystemAdapter;
    if (typeof extFs.deleteFile === 'function') {
      try {
        await extFs.deleteFile(legacyPath);
      } catch (error) {
        result.warnings.push(`Failed to delete old format file: ${error}`);
      }
    } else {
      result.warnings.push('File deletion not supported by file system adapter');
    }
  }

  result.success = true;
  result.format.to = 'file-per-artifact';
  return result;
}

/**
 * Verify migration by comparing artifact counts
 */
async function verifyMigration(
  fs: FileSystemAdapter,
  projectRoot: string,
  originalRegistry: ArtifactRegistry
): Promise<{ success: boolean; errors: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const basePath = `${projectRoot}/${ARTIFACTS_DIR}`;

  try {
    // Load indexes
    const nameIndex = await loadNameIndex(fs, basePath);
    const relIndex = await loadRelationshipIndex(fs, basePath);

    // Compare counts
    const expectedArtifacts = originalRegistry.artifacts.size;
    const actualArtifacts = Object.keys(nameIndex.entries).length;

    if (expectedArtifacts !== actualArtifacts) {
      errors.push(
        `Artifact count mismatch: expected ${expectedArtifacts}, got ${actualArtifacts}`
      );
    }

    const expectedRelationships = originalRegistry.relationships.size;
    const actualRelationships = Object.keys(relIndex.entries).length;

    if (expectedRelationships !== actualRelationships) {
      errors.push(
        `Relationship count mismatch: expected ${expectedRelationships}, got ${actualRelationships}`
      );
    }

    // Verify each artifact URN exists in index
    for (const urn of originalRegistry.artifacts.keys()) {
      if (!(urn in nameIndex.entries)) {
        warnings.push(`Missing artifact in new format: ${urn}`);
      }
    }

    // Verify each relationship URN exists in index
    for (const urn of originalRegistry.relationships.keys()) {
      if (!(urn in relIndex.entries)) {
        warnings.push(`Missing relationship in new format: ${urn}`);
      }
    }
  } catch (error) {
    errors.push(`Verification failed: ${error}`);
  }

  return {
    success: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Rollback migration by restoring from backup
 */
export async function rollbackMigration(
  fs: ExtendedFileSystemAdapter,
  projectRoot: string,
  backupPath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Read backup
    const backupContent = await fs.readFile(backupPath);

    // Restore to original location
    const originalPath = `${projectRoot}/${DEFAULT_ARTIFACTS_PATH}`;
    await fs.writeFile(originalPath, backupContent);

    // Delete new format files
    const basePath = `${projectRoot}/${ARTIFACTS_DIR}`;

    // Delete registry.json
    try {
      await fs.deleteFile(`${basePath}/registry.json`);
    } catch {
      // Ignore if doesn't exist
    }

    // Delete indexes
    try {
      await fs.deleteFile(`${basePath}/.name-index.json`);
      await fs.deleteFile(`${basePath}/.rel-index.json`);
    } catch {
      // Ignore if don't exist
    }

    // Note: We don't delete artifact/relationship folders as that would be too destructive
    // Those would need manual cleanup

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Format migration result for display
 */
export function formatMigrationResult(result: MigrationResult): string {
  const lines: string[] = [];

  lines.push('# Migration Result');
  lines.push('');

  if (result.success) {
    lines.push('**Status**: ✅ Success');
  } else {
    lines.push('**Status**: ❌ Failed');
  }

  lines.push('');
  lines.push('## Format Change');
  lines.push(`- From: ${result.format.from}`);
  lines.push(`- To: ${result.format.to}`);
  lines.push('');

  lines.push('## Statistics');
  lines.push(`- Artifacts migrated: ${result.stats.artifactsMigrated}`);
  lines.push(`- Relationships migrated: ${result.stats.relationshipsMigrated}`);
  if (result.stats.backupPath) {
    lines.push(`- Backup created: ${result.stats.backupPath}`);
  }
  lines.push('');

  if (result.errors.length > 0) {
    lines.push('## Errors');
    for (const error of result.errors) {
      lines.push(`- ❌ ${error}`);
    }
    lines.push('');
  }

  if (result.warnings.length > 0) {
    lines.push('## Warnings');
    for (const warning of result.warnings) {
      lines.push(`- ⚠️ ${warning}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate migration instructions
 */
export function generateMigrationInstructions(): string {
  return `# Migrating to File-Per-Artifact Format

The new file-per-artifact format provides:
- **Git-friendly**: Each artifact is a separate file, enabling clean diffs and merges
- **Human-readable**: Markdown with YAML frontmatter
- **Semantic search**: Compatible with QMD for AI-powered search

## Before You Begin

1. Ensure your current registry is committed to git
2. Review the migration preview with \`/arch-registry migrate --preview\`

## Migration Steps

1. **Preview**: Check what will be migrated
   \`\`\`
   /arch-registry migrate --preview
   \`\`\`

2. **Migrate with backup** (recommended):
   \`\`\`
   /arch-registry migrate --backup
   \`\`\`

3. **Verify**: Check the new format
   \`\`\`
   /arch-registry stats
   \`\`\`

4. **Commit**: Add new files to git
   \`\`\`
   git add .architecture/
   git commit -m "Migrate architecture registry to file-per-artifact format"
   \`\`\`

## New Directory Structure

After migration, your \`.architecture/\` directory will contain:

\`\`\`
.architecture/
├── registry.json              # Registry metadata
├── .name-index.json           # Fast URN → file lookup
├── .rel-index.json            # Relationship indexes
├── artifacts/
│   ├── system/
│   │   └── {org}_{repo}_{name}.md
│   ├── container/
│   ├── component/
│   └── code/
└── relationships/
    └── {source}--{type}--{target}.md
\`\`\`

## Rollback

If needed, you can rollback using the backup file:
\`\`\`
/arch-registry migrate --rollback
\`\`\`

Or restore from git:
\`\`\`
git checkout -- .architecture/
\`\`\`
`;
}
