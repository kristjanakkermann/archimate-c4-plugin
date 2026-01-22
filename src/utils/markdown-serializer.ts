/**
 * Markdown Serializer
 *
 * Converts Artifact and Relationship objects to/from Markdown files
 * with YAML frontmatter. Enables human-readable, git-friendly storage.
 *
 * Format:
 * ---
 * urn: "urn:archimate-c4:..."
 * identifier: { org, repo, category, name, qualifier? }
 * displayName: "..."
 * ...
 * ---
 *
 * # Display Name
 *
 * Description content...
 */

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type {
  Artifact,
  ArtifactRelationship,
  ArtifactFrontmatter,
  RelationshipFrontmatter,
  ArtifactCategory
} from '../types/artifacts.js';

/** Frontmatter delimiter */
const FRONTMATTER_DELIMITER = '---';

/**
 * Parse markdown content into frontmatter and body
 */
export function parseMarkdown<T>(content: string): { frontmatter: T; body: string } {
  const lines = content.split('\n');

  // Check for frontmatter
  if (lines[0] !== FRONTMATTER_DELIMITER) {
    throw new Error('Missing frontmatter delimiter at start of file');
  }

  // Find closing delimiter
  let closingIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === FRONTMATTER_DELIMITER) {
      closingIndex = i;
      break;
    }
  }

  if (closingIndex === -1) {
    throw new Error('Missing closing frontmatter delimiter');
  }

  // Extract frontmatter YAML
  const frontmatterYaml = lines.slice(1, closingIndex).join('\n');
  const frontmatter = parseYaml(frontmatterYaml) as T;

  // Extract body (everything after frontmatter)
  const body = lines.slice(closingIndex + 1).join('\n').trim();

  return { frontmatter, body };
}

/**
 * Serialize frontmatter and body to markdown
 */
export function serializeMarkdown(
  frontmatter: object,
  body: string
): string {
  const yamlContent = stringifyYaml(frontmatter, {
    indent: 2,
    lineWidth: 0, // Disable line wrapping
    defaultStringType: 'QUOTE_DOUBLE',
    defaultKeyType: 'PLAIN'
  });

  return `${FRONTMATTER_DELIMITER}\n${yamlContent}${FRONTMATTER_DELIMITER}\n\n${body}`;
}

/**
 * Convert Artifact to frontmatter
 */
export function artifactToFrontmatter(artifact: Artifact): ArtifactFrontmatter {
  return {
    urn: artifact.urn,
    identifier: artifact.identifier,
    displayName: artifact.displayName,
    category: artifact.category,
    technology: artifact.technology,
    tags: artifact.tags,
    source: artifact.source,
    properties: artifact.properties,
    version: artifact.version,
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt
  };
}

/**
 * Convert frontmatter and body to Artifact
 */
export function frontmatterToArtifact(
  frontmatter: ArtifactFrontmatter,
  body: string
): Artifact {
  return {
    urn: frontmatter.urn,
    identifier: frontmatter.identifier,
    displayName: frontmatter.displayName,
    description: body || undefined,
    category: frontmatter.category as ArtifactCategory,
    source: frontmatter.source,
    technology: frontmatter.technology,
    tags: frontmatter.tags || [],
    properties: frontmatter.properties || {},
    createdAt: frontmatter.createdAt,
    updatedAt: frontmatter.updatedAt,
    version: frontmatter.version
  };
}

/**
 * Serialize Artifact to markdown string
 */
export function serializeArtifact(artifact: Artifact): string {
  const frontmatter = artifactToFrontmatter(artifact);
  const body = generateArtifactBody(artifact);
  return serializeMarkdown(frontmatter, body);
}

/**
 * Deserialize markdown string to Artifact
 */
export function deserializeArtifact(content: string): Artifact {
  const { frontmatter, body } = parseMarkdown<ArtifactFrontmatter>(content);
  return frontmatterToArtifact(frontmatter, body);
}

/**
 * Generate markdown body for artifact
 */
function generateArtifactBody(artifact: Artifact): string {
  const sections: string[] = [];

  // Title
  sections.push(`# ${artifact.displayName}`);
  sections.push('');

  // Description
  if (artifact.description) {
    sections.push(artifact.description);
    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Convert ArtifactRelationship to frontmatter
 */
export function relationshipToFrontmatter(rel: ArtifactRelationship): RelationshipFrontmatter {
  return {
    urn: rel.urn,
    sourceUrn: rel.sourceUrn,
    targetUrn: rel.targetUrn,
    type: rel.type,
    label: rel.label,
    technology: rel.technology,
    direction: rel.direction,
    source: rel.source,
    createdAt: rel.createdAt,
    updatedAt: rel.updatedAt
  };
}

/**
 * Convert frontmatter and body to ArtifactRelationship
 */
export function frontmatterToRelationship(
  frontmatter: RelationshipFrontmatter,
  _body: string
): ArtifactRelationship {
  return {
    urn: frontmatter.urn,
    sourceUrn: frontmatter.sourceUrn,
    targetUrn: frontmatter.targetUrn,
    type: frontmatter.type,
    label: frontmatter.label,
    technology: frontmatter.technology,
    direction: frontmatter.direction || 'forward',
    source: frontmatter.source,
    createdAt: frontmatter.createdAt,
    updatedAt: frontmatter.updatedAt
  };
}

/**
 * Serialize ArtifactRelationship to markdown string
 */
export function serializeRelationship(rel: ArtifactRelationship): string {
  const frontmatter = relationshipToFrontmatter(rel);
  const body = generateRelationshipBody(rel);
  return serializeMarkdown(frontmatter, body);
}

/**
 * Deserialize markdown string to ArtifactRelationship
 */
export function deserializeRelationship(content: string): ArtifactRelationship {
  const { frontmatter, body } = parseMarkdown<RelationshipFrontmatter>(content);
  return frontmatterToRelationship(frontmatter, body);
}

/**
 * Generate markdown body for relationship
 */
function generateRelationshipBody(rel: ArtifactRelationship): string {
  const sections: string[] = [];

  // Title showing relationship
  const sourceShort = rel.sourceUrn.split(':').pop() || rel.sourceUrn;
  const targetShort = rel.targetUrn.split(':').pop() || rel.targetUrn;
  sections.push(`# ${sourceShort} → ${targetShort}`);
  sections.push('');

  // Relationship details
  sections.push(`**Type**: ${rel.type}`);
  if (rel.label) {
    sections.push(`**Label**: ${rel.label}`);
  }
  if (rel.technology) {
    sections.push(`**Technology**: ${rel.technology}`);
  }
  sections.push('');

  return sections.join('\n');
}

/**
 * Generate file path for artifact based on category and identifier
 *
 * Format: artifacts/{category}/{org}_{repo}_{qualifier?_}{name}.md
 */
export function generateArtifactFilePath(artifact: Artifact): string {
  const { identifier } = artifact;
  const parts = [identifier.org, identifier.repo];

  if (identifier.qualifier) {
    parts.push(identifier.qualifier.replace(/\//g, '_'));
  }
  parts.push(identifier.name);

  const fileName = parts.join('_') + '.md';
  return `artifacts/${artifact.category}/${fileName}`;
}

/**
 * Generate file path for relationship
 *
 * Format: relationships/{sourceShort}--{type}--{targetShort}.md
 */
export function generateRelationshipFilePath(rel: ArtifactRelationship): string {
  const sourceShort = rel.sourceUrn.split(':').pop() || 'unknown';
  const targetShort = rel.targetUrn.split(':').pop() || 'unknown';
  const fileName = `${sourceShort}--${rel.type}--${targetShort}.md`;
  return `relationships/${fileName}`;
}

/**
 * Extract URN from file path (reverse of generateArtifactFilePath)
 * Note: This is a heuristic and may not work for all cases
 */
export function extractUrnFromFilePath(filePath: string): string | null {
  // This would require reading the file to get the actual URN
  // The file path doesn't contain enough info to reconstruct URN
  return null;
}
