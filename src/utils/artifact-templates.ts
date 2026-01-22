/**
 * Artifact Templates
 *
 * Predefined templates for creating architectural artifacts.
 * Templates ensure consistency and provide sensible defaults.
 */

import type {
  Artifact,
  ArtifactCategory,
  ArtifactIdentifier,
  ArtifactSource,
  ArtifactTemplate
} from '../types/artifacts.js';
import { createArtifact, generateUrn } from './artifact-registry.js';

/**
 * Built-in artifact templates
 */
export const ARTIFACT_TEMPLATES: Record<string, ArtifactTemplate> = {
  // C4 Templates
  'c4-person': {
    id: 'c4-person',
    category: 'person',
    displayNamePattern: '{name}',
    descriptionPattern: 'Person who interacts with the system',
    requiredFields: ['name'],
    defaultTags: ['c4', 'person']
  },

  'c4-system': {
    id: 'c4-system',
    category: 'system',
    displayNamePattern: '{name}',
    descriptionPattern: 'Software system',
    requiredFields: ['name'],
    defaultTags: ['c4', 'system']
  },

  'c4-external-system': {
    id: 'c4-external-system',
    category: 'external',
    displayNamePattern: '{name}',
    descriptionPattern: 'External software system',
    requiredFields: ['name'],
    defaultTags: ['c4', 'external'],
    defaultProperties: { external: true }
  },

  'c4-container': {
    id: 'c4-container',
    category: 'container',
    displayNamePattern: '{name}',
    descriptionPattern: 'Container: {technology}',
    requiredFields: ['name', 'technology'],
    defaultTags: ['c4', 'container']
  },

  'c4-component': {
    id: 'c4-component',
    category: 'component',
    displayNamePattern: '{name}',
    descriptionPattern: 'Component: {technology}',
    requiredFields: ['name'],
    defaultTags: ['c4', 'component']
  },

  'c4-code-class': {
    id: 'c4-code-class',
    category: 'code',
    displayNamePattern: '{name}',
    descriptionPattern: 'Class in {filePath}',
    requiredFields: ['name', 'filePath'],
    defaultTags: ['c4', 'code', 'class']
  },

  'c4-code-interface': {
    id: 'c4-code-interface',
    category: 'code',
    displayNamePattern: '{name}',
    descriptionPattern: 'Interface in {filePath}',
    requiredFields: ['name', 'filePath'],
    defaultTags: ['c4', 'code', 'interface']
  },

  'c4-code-function': {
    id: 'c4-code-function',
    category: 'code',
    displayNamePattern: '{name}',
    descriptionPattern: 'Function in {filePath}',
    requiredFields: ['name', 'filePath'],
    defaultTags: ['c4', 'code', 'function']
  },

  // ArchiMate Business Layer Templates
  'archimate-business-actor': {
    id: 'archimate-business-actor',
    category: 'archimate',
    displayNamePattern: '{name}',
    descriptionPattern: 'Business actor',
    requiredFields: ['name'],
    defaultTags: ['archimate', 'business', 'actor'],
    defaultProperties: { layer: 'business', elementType: 'businessActor' }
  },

  'archimate-business-role': {
    id: 'archimate-business-role',
    category: 'archimate',
    displayNamePattern: '{name}',
    descriptionPattern: 'Business role',
    requiredFields: ['name'],
    defaultTags: ['archimate', 'business', 'role'],
    defaultProperties: { layer: 'business', elementType: 'businessRole' }
  },

  'archimate-business-process': {
    id: 'archimate-business-process',
    category: 'archimate',
    displayNamePattern: '{name}',
    descriptionPattern: 'Business process',
    requiredFields: ['name'],
    defaultTags: ['archimate', 'business', 'process'],
    defaultProperties: { layer: 'business', elementType: 'businessProcess' }
  },

  'archimate-business-service': {
    id: 'archimate-business-service',
    category: 'archimate',
    displayNamePattern: '{name}',
    descriptionPattern: 'Business service',
    requiredFields: ['name'],
    defaultTags: ['archimate', 'business', 'service'],
    defaultProperties: { layer: 'business', elementType: 'businessService' }
  },

  // ArchiMate Application Layer Templates
  'archimate-application-component': {
    id: 'archimate-application-component',
    category: 'archimate',
    displayNamePattern: '{name}',
    descriptionPattern: 'Application component',
    requiredFields: ['name'],
    defaultTags: ['archimate', 'application', 'component'],
    defaultProperties: { layer: 'application', elementType: 'applicationComponent' }
  },

  'archimate-application-service': {
    id: 'archimate-application-service',
    category: 'archimate',
    displayNamePattern: '{name}',
    descriptionPattern: 'Application service',
    requiredFields: ['name'],
    defaultTags: ['archimate', 'application', 'service'],
    defaultProperties: { layer: 'application', elementType: 'applicationService' }
  },

  'archimate-application-interface': {
    id: 'archimate-application-interface',
    category: 'archimate',
    displayNamePattern: '{name}',
    descriptionPattern: 'Application interface',
    requiredFields: ['name'],
    defaultTags: ['archimate', 'application', 'interface'],
    defaultProperties: { layer: 'application', elementType: 'applicationInterface' }
  },

  'archimate-data-object': {
    id: 'archimate-data-object',
    category: 'archimate',
    displayNamePattern: '{name}',
    descriptionPattern: 'Data object',
    requiredFields: ['name'],
    defaultTags: ['archimate', 'application', 'data'],
    defaultProperties: { layer: 'application', elementType: 'dataObject' }
  },

  // ArchiMate Technology Layer Templates
  'archimate-node': {
    id: 'archimate-node',
    category: 'archimate',
    displayNamePattern: '{name}',
    descriptionPattern: 'Infrastructure node',
    requiredFields: ['name'],
    defaultTags: ['archimate', 'technology', 'node'],
    defaultProperties: { layer: 'technology', elementType: 'node' }
  },

  'archimate-device': {
    id: 'archimate-device',
    category: 'archimate',
    displayNamePattern: '{name}',
    descriptionPattern: 'Physical device',
    requiredFields: ['name'],
    defaultTags: ['archimate', 'technology', 'device'],
    defaultProperties: { layer: 'technology', elementType: 'device' }
  },

  'archimate-system-software': {
    id: 'archimate-system-software',
    category: 'archimate',
    displayNamePattern: '{name}',
    descriptionPattern: 'System software',
    requiredFields: ['name'],
    defaultTags: ['archimate', 'technology', 'software'],
    defaultProperties: { layer: 'technology', elementType: 'systemSoftware' }
  },

  'archimate-artifact': {
    id: 'archimate-artifact',
    category: 'archimate',
    displayNamePattern: '{name}',
    descriptionPattern: 'Deployment artifact',
    requiredFields: ['name'],
    defaultTags: ['archimate', 'technology', 'artifact'],
    defaultProperties: { layer: 'technology', elementType: 'artifact' }
  }
};

/**
 * Create an artifact from a template
 */
export function createFromTemplate(
  templateId: string,
  identifier: ArtifactIdentifier,
  values: Record<string, string>,
  options: {
    source?: ArtifactSource;
    technology?: string;
    additionalTags?: string[];
    additionalProperties?: Record<string, string | number | boolean>;
  } = {}
): Artifact {
  const template = ARTIFACT_TEMPLATES[templateId];
  if (!template) {
    throw new Error(`Unknown template: ${templateId}`);
  }

  // Validate required fields
  for (const field of template.requiredFields) {
    if (!values[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Apply pattern substitution
  const displayName = substitutePattern(template.displayNamePattern, values);
  const description = template.descriptionPattern
    ? substitutePattern(template.descriptionPattern, values)
    : undefined;

  // Merge tags
  const tags = [
    ...(template.defaultTags || []),
    ...(options.additionalTags || [])
  ];

  // Merge properties
  const properties = {
    ...(template.defaultProperties || {}),
    ...(options.additionalProperties || {})
  };

  return createArtifact(identifier, displayName, {
    description,
    source: options.source,
    technology: options.technology || values.technology,
    tags,
    properties
  });
}

/**
 * Substitute {tokens} in a pattern string
 */
function substitutePattern(pattern: string, values: Record<string, string>): string {
  return pattern.replace(/\{(\w+)\}/g, (match, key) => {
    return values[key] || match;
  });
}

/**
 * Get template by category
 */
export function getTemplatesForCategory(category: ArtifactCategory): ArtifactTemplate[] {
  return Object.values(ARTIFACT_TEMPLATES).filter(t => t.category === category);
}

/**
 * Infer best template from source analysis
 */
export function inferTemplate(
  category: ArtifactCategory,
  hints: {
    isExternal?: boolean;
    elementType?: string;
    layer?: string;
    codeType?: 'class' | 'interface' | 'function' | 'module';
  }
): string {
  // C4 inference
  if (category === 'external' || hints.isExternal) {
    return 'c4-external-system';
  }

  if (category === 'code') {
    switch (hints.codeType) {
      case 'interface': return 'c4-code-interface';
      case 'function': return 'c4-code-function';
      default: return 'c4-code-class';
    }
  }

  // ArchiMate inference
  if (category === 'archimate' && hints.elementType) {
    const templateId = `archimate-${hints.elementType.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
    if (ARTIFACT_TEMPLATES[templateId]) {
      return templateId;
    }
  }

  // Default templates by category
  const defaults: Record<ArtifactCategory, string> = {
    person: 'c4-person',
    system: 'c4-system',
    container: 'c4-container',
    component: 'c4-component',
    code: 'c4-code-class',
    archimate: 'archimate-application-component',
    external: 'c4-external-system',
    relationship: 'c4-system' // Not typically templated
  };

  return defaults[category] || 'c4-component';
}

/**
 * Validate artifact against its template
 */
export function validateAgainstTemplate(
  artifact: Artifact,
  templateId: string
): { valid: boolean; errors: string[] } {
  const template = ARTIFACT_TEMPLATES[templateId];
  if (!template) {
    return { valid: false, errors: [`Unknown template: ${templateId}`] };
  }

  const errors: string[] = [];

  // Check category
  if (artifact.category !== template.category) {
    errors.push(`Category mismatch: expected ${template.category}, got ${artifact.category}`);
  }

  // Check required tags
  for (const tag of template.defaultTags || []) {
    if (!artifact.tags?.includes(tag)) {
      errors.push(`Missing required tag: ${tag}`);
    }
  }

  // Check required properties
  for (const [key, value] of Object.entries(template.defaultProperties || {})) {
    if (artifact.properties?.[key] !== value) {
      errors.push(`Property mismatch for ${key}: expected ${value}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
