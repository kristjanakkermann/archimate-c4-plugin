/**
 * Artifact Registry Skill
 * Manage persistent architectural artifacts
 *
 * Usage: /arch-registry [command] [options]
 *
 * Commands:
 *   list      - List all registered artifacts
 *   show      - Show artifact details by URN or name
 *   export    - Export registry to markdown
 *   stats     - Show registry statistics
 *   sync      - Sync artifacts with codebase
 *   migrate   - Migrate to file-per-artifact format
 *   search    - Search artifacts using QMD semantic search
 *   info      - Show storage format information
 *
 * Options:
 *   --category <cat>  - Filter by category (system, container, component, code)
 *   --tag <tag>       - Filter by tag
 *   --format <fmt>    - Output format (table, json, markdown)
 *   --preview         - Preview migration without changes
 *   --backup          - Create backup before migration
 *   --rollback        - Rollback migration from backup
 */

import type { SkillContext, SkillResult } from '../types/index.js';
import type { Artifact, ArtifactCategory, ArtifactRegistry } from '../types/artifacts.js';

export const SKILL_NAME = 'artifact-registry';
export const SKILL_COMMAND = 'arch-registry';
export const SKILL_DESCRIPTION = 'Manage persistent architectural artifacts';

export const SKILL_PROMPT = `You are managing an architectural artifact registry.

## Artifact URN Format

Each artifact has a unique URN (Uniform Resource Name) in the format:
\`urn:archimate-c4:{org}:{repo}:{category}:{qualifier?/}{name}\`

Examples:
- \`urn:archimate-c4:acme:ecommerce:system:ecommerce-platform\`
- \`urn:archimate-c4:acme:ecommerce:container:api-server\`
- \`urn:archimate-c4:acme:ecommerce:component:api-server/order-controller\`
- \`urn:archimate-c4:acme:ecommerce:code:api-server/order-controller/OrderService\`

## Categories

- **person**: Users/actors who interact with systems
- **system**: Top-level software systems (C4 Level 1)
- **external**: External systems/services
- **container**: Deployable units (C4 Level 2)
- **component**: Major modules within containers (C4 Level 3)
- **code**: Classes, interfaces, functions (C4 Level 4)
- **archimate**: ArchiMate elements (any layer)

## Storage Formats

### Legacy Format
- Single file: \`.architecture/artifacts.json\`
- All artifacts in one JSON file

### File-Per-Artifact Format (New)
- Individual markdown files per artifact
- YAML frontmatter + markdown body
- Git-friendly: clean diffs, merges, branch per artifact
- Supports QMD semantic search

## Commands

### List Artifacts
\`/arch-registry list [--category <cat>] [--tag <tag>]\`

### Show Artifact Details
\`/arch-registry show <urn-or-name>\`

### Export to Markdown
\`/arch-registry export\`

### Show Statistics
\`/arch-registry stats\`

### Show Storage Info
\`/arch-registry info\`

### Migrate to File-Per-Artifact
\`/arch-registry migrate [--preview] [--backup] [--rollback]\`

### Semantic Search (requires QMD)
\`/arch-registry search "query"\`

### Sync with Codebase
\`/arch-registry sync\`
Analyzes the codebase and updates/creates artifacts for discovered components.
`;

interface RegistrySkillArgs {
  command: 'list' | 'show' | 'export' | 'stats' | 'sync' | 'migrate' | 'search' | 'info';
  category?: ArtifactCategory;
  tag?: string;
  format?: 'table' | 'json' | 'markdown';
  target?: string; // URN or name for show command, query for search
  // Migration options
  preview?: boolean;
  backup?: boolean;
  rollback?: boolean;
  // Search options
  query?: string;
}

/**
 * Parse skill arguments
 */
export function parseArgs(argsString?: string): RegistrySkillArgs {
  const args: RegistrySkillArgs = {
    command: 'list',
    format: 'table'
  };

  if (!argsString) return args;

  const parts = argsString.trim().split(/\s+/);
  let i = 0;

  // First non-flag argument is the command
  if (parts[0] && !parts[0].startsWith('--')) {
    const cmd = parts[0];
    if (['list', 'show', 'export', 'stats', 'sync', 'migrate', 'search', 'info'].includes(cmd)) {
      args.command = cmd as RegistrySkillArgs['command'];
      i = 1;
    }
  }

  // Parse remaining arguments
  while (i < parts.length) {
    const part = parts[i];

    if (part === '--category' && parts[i + 1]) {
      args.category = parts[++i] as ArtifactCategory;
    } else if (part === '--tag' && parts[i + 1]) {
      args.tag = parts[++i];
    } else if (part === '--format' && parts[i + 1]) {
      args.format = parts[++i] as 'table' | 'json' | 'markdown';
    } else if (part === '--preview') {
      args.preview = true;
    } else if (part === '--backup') {
      args.backup = true;
    } else if (part === '--rollback') {
      args.rollback = true;
    } else if (!part.startsWith('--')) {
      // Capture remaining as target/query
      if (args.command === 'show') {
        args.target = part;
      } else if (args.command === 'search') {
        // Capture rest as search query
        args.query = parts.slice(i).join(' ').replace(/^["']|["']$/g, '');
        break;
      }
    }

    i++;
  }

  return args;
}

/**
 * Format artifact for table display
 */
function formatArtifactTable(artifacts: Artifact[]): string {
  if (artifacts.length === 0) {
    return 'No artifacts found.';
  }

  const lines: string[] = [
    '| URN | Name | Category | Technology |',
    '|-----|------|----------|------------|'
  ];

  for (const a of artifacts) {
    const shortUrn = a.urn.split(':').slice(-2).join(':');
    lines.push(`| \`${shortUrn}\` | ${a.displayName} | ${a.category} | ${a.technology || '-'} |`);
  }

  return lines.join('\n');
}

/**
 * Format artifact details
 */
function formatArtifactDetails(artifact: Artifact): string {
  const lines: string[] = [
    `# ${artifact.displayName}`,
    '',
    `**URN**: \`${artifact.urn}\``,
    `**Category**: ${artifact.category}`,
    artifact.technology ? `**Technology**: ${artifact.technology}` : null,
    artifact.description ? `**Description**: ${artifact.description}` : null,
    '',
    '## Source',
    artifact.source?.repository ? `- Repository: ${artifact.source.repository}` : null,
    artifact.source?.filePath ? `- File: \`${artifact.source.filePath}\`` : null,
    artifact.source?.lineRange ? `- Lines: ${artifact.source.lineRange[0]}-${artifact.source.lineRange[1]}` : null,
    '',
    '## Tags',
    artifact.tags?.length ? artifact.tags.map(t => `- ${t}`).join('\n') : '- (none)',
    '',
    '## Properties',
    artifact.properties && Object.keys(artifact.properties).length > 0
      ? Object.entries(artifact.properties).map(([k, v]) => `- ${k}: ${v}`).join('\n')
      : '- (none)',
    '',
    '## Metadata',
    `- Created: ${artifact.createdAt}`,
    `- Updated: ${artifact.updatedAt}`,
    `- Version: ${artifact.version}`
  ].filter(Boolean) as string[];

  return lines.join('\n');
}

/**
 * Generate registry statistics
 */
function generateStats(registry: ArtifactRegistry): string {
  const stats: Record<string, number> = {
    totalArtifacts: registry.artifacts.size,
    totalRelationships: registry.relationships.size
  };

  // Count by category
  for (const artifact of registry.artifacts.values()) {
    const key = artifact.category;
    stats[key] = (stats[key] || 0) + 1;
  }

  const lines: string[] = [
    '# Registry Statistics',
    '',
    `**Registry**: ${registry.name}`,
    `**Repository**: ${registry.repository || 'N/A'}`,
    `**Last Updated**: ${registry.updatedAt}`,
    '',
    '## Totals',
    `- Total Artifacts: ${stats.totalArtifacts}`,
    `- Total Relationships: ${stats.totalRelationships}`,
    '',
    '## By Category',
    ...Object.entries(stats)
      .filter(([k]) => !['totalArtifacts', 'totalRelationships'].includes(k))
      .map(([k, v]) => `- ${k}: ${v}`)
  ];

  return lines.join('\n');
}

/**
 * Main skill execution
 */
export async function execute(context: SkillContext): Promise<SkillResult> {
  const args = parseArgs(context.args);

  // Note: In real implementation, this would load the registry from disk
  // using the artifact-persistence module. Here we provide instructions.

  let output: string;

  switch (args.command) {
    case 'list':
      output = `## List Artifacts

To list all registered artifacts, the system will:
1. Load the registry from \`.architecture/\`
2. Filter by category: ${args.category || 'all'}
3. Filter by tag: ${args.tag || 'none'}

**Instructions for Claude:**
Use the Read tool to load the registry file or use the file-per-artifact indexes, then filter and display artifacts.

Example artifacts table:
${formatArtifactTable([])}

If no registry exists yet, use \`/arch-analyze\` to scan the codebase and create initial artifacts.`;
      break;

    case 'show':
      output = `## Show Artifact

To show artifact details for: ${args.target || '(not specified)'}

**Instructions for Claude:**
1. Load the registry from \`.architecture/\`
2. Find artifact by URN or display name
3. Show full details including source, relationships, and properties

Use \`resolveArtifact(registry, urn, includeRelationships=true)\` to get full details.`;
      break;

    case 'export':
      output = `## Export Registry

Exporting registry to markdown format.

**Instructions for Claude:**
1. Load the registry from \`.architecture/\`
2. Use \`exportRegistryToMarkdown(registry)\` to generate documentation
3. Output the markdown or save to a file

The export will include:
- Summary statistics
- All artifacts grouped by category
- All relationships in a table`;
      break;

    case 'stats':
      output = `## Registry Statistics

**Instructions for Claude:**
1. Load the registry from \`.architecture/\`
2. Use \`getRegistryStats(registry)\` to compute statistics
3. Display summary

Statistics include:
- Total artifact count
- Artifact count by category
- Relationship count by type`;
      break;

    case 'info':
      output = `## Storage Information

**Instructions for Claude:**
1. Use \`detectStorageFormat(fs, projectRoot)\` to check format
2. Use \`getStorageInfo(fs, projectRoot)\` for details
3. Display format and statistics

Current storage formats:
- **legacy**: Single \`artifacts.json\` file
- **file-per-artifact**: Individual markdown files with indexes

To see current format:
\`\`\`typescript
import { getStorageInfo } from './utils/artifact-persistence.js';
const info = await getStorageInfo(fs, projectRoot);
console.log('Format:', info.format);
console.log('Artifacts:', info.artifactCount);
console.log('Relationships:', info.relationshipCount);
\`\`\``;
      break;

    case 'migrate':
      if (args.rollback) {
        output = `## Rollback Migration

To rollback a migration:

**Instructions for Claude:**
1. Find the backup file in \`.architecture/artifacts.json.backup.*\`
2. Use \`rollbackMigration(fs, projectRoot, backupPath)\`
3. Verify the rollback succeeded

\`\`\`typescript
import { rollbackMigration } from './utils/migration.js';
const result = await rollbackMigration(fs, projectRoot, backupPath);
if (result.success) {
  console.log('Rollback successful');
} else {
  console.error('Rollback failed:', result.error);
}
\`\`\``;
      } else if (args.preview) {
        output = `## Migration Preview

Previewing migration from legacy format to file-per-artifact format.

**Instructions for Claude:**
1. Use \`getMigrationPreview(fs, projectRoot)\` to check migration status
2. Display what will be migrated

\`\`\`typescript
import { getMigrationPreview } from './utils/migration.js';
const preview = await getMigrationPreview(fs, projectRoot);
console.log('Current format:', preview.currentFormat);
console.log('Artifacts to migrate:', preview.artifactCount);
console.log('Relationships to migrate:', preview.relationshipCount);
console.log('Estimated files:', preview.estimatedFiles);
console.log('Can migrate:', preview.canMigrate);
\`\`\`

If migration is possible, run \`/arch-registry migrate --backup\` to proceed.`;
      } else {
        output = `## Migrate to File-Per-Artifact Format

This command converts from the legacy single-file format to the new file-per-artifact format.

**New format benefits:**
- Git-friendly: Each artifact is a separate file
- Human-readable: Markdown with YAML frontmatter
- Semantic search: Compatible with QMD

**Instructions for Claude:**
1. Check if migration is needed with \`isMigrationNeeded(fs, projectRoot)\`
2. Use \`migrateToFilePerArtifact(fs, projectRoot, options)\`
3. Display results

\`\`\`typescript
import { migrateToFilePerArtifact, formatMigrationResult } from './utils/migration.js';

const result = await migrateToFilePerArtifact(fs, projectRoot, {
  createBackup: ${args.backup || false},
  verify: true
});

console.log(formatMigrationResult(result));
\`\`\`

Options:
- \`--backup\`: Create backup before migrating (recommended)
- \`--preview\`: Preview what will be migrated
- \`--rollback\`: Restore from backup`;
      }
      break;

    case 'search':
      output = `## Semantic Search

Searching for: "${args.query || '(no query provided)'}"

**QMD Integration:**
QMD provides semantic search capabilities:
- BM25 text search
- Vector similarity search
- LLM re-ranking

**Instructions for Claude:**
1. Check if QMD is available using MCP tools
2. If available, use QMD's \`search\` or \`query\` tool
3. If not available, fall back to index-based search

**With QMD (preferred):**
\`\`\`
qmd search architecture "${args.query}"
\`\`\`

**Without QMD (fallback):**
\`\`\`typescript
import { searchDisplayNames } from './utils/index-manager.js';
const results = searchDisplayNames(nameIndex, "${args.query}");
\`\`\`

**QMD Setup:**
If QMD is not configured, users can add it:
1. Install: \`npm install -g qmd\` or \`brew install qmd\`
2. Configure MCP server in settings
3. Add collection: \`qmd add architecture ".architecture/**/*.md"\`

See the QMD documentation for more details.`;
      break;

    case 'sync':
      output = `## Sync Artifacts with Codebase

This command analyzes the codebase and updates the artifact registry.

**Instructions for Claude:**
1. Load existing registry (or create new one)
2. Scan the codebase using Glob and Grep tools
3. For each discovered component:
   - Check if artifact already exists (by URN)
   - If exists: update properties/source info
   - If new: create artifact using templates
4. Save updated registry

**Linking Process:**
Use the artifact linker utilities:
- \`linkClass(registry, classInfo, config)\` for classes
- \`linkFunction(registry, funcInfo, config)\` for functions
- \`linkModule(registry, moduleInfo, config)\` for modules
- \`linkDependency(registry, depInfo, config)\` for dependencies

**URN Generation:**
URNs are derived from:
- Organization (from git remote or config)
- Repository name
- Category (system/container/component/code)
- Canonical name (from file path and entity name)
- Qualifier (parent path for nested elements)`;
      break;

    default:
      output = `Unknown command: ${args.command}

Available commands:
- list      - List all registered artifacts
- show      - Show artifact details by URN or name
- export    - Export registry to markdown
- stats     - Show registry statistics
- info      - Show storage format information
- migrate   - Migrate to file-per-artifact format
- search    - Search artifacts using QMD semantic search
- sync      - Sync artifacts with codebase`;
  }

  return {
    success: true,
    output
  };
}
