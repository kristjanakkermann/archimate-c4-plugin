/**
 * Artifact Linker
 *
 * Utilities for linking code analysis results to persistent artifacts.
 * Handles deduplication, matching, and relationship inference.
 */

import type {
  Artifact,
  ArtifactCategory,
  ArtifactIdentifier,
  ArtifactRegistry,
  ArtifactRelationship,
  ArtifactSource,
  RelationshipType
} from '../types/artifacts.js';
import type { ClassInfo, FunctionInfo, ModuleInfo, DependencyInfo } from '../types/index.js';
import {
  createArtifact,
  createRelationship,
  registerArtifact,
  registerRelationship,
  findArtifactByName,
  generateUrn,
  sanitizeUrnPart,
  deriveCanonicalName,
  deriveQualifier
} from './artifact-registry.js';
import { createFromTemplate, inferTemplate } from './artifact-templates.js';

/**
 * Link configuration for artifact creation
 */
export interface LinkConfig {
  org: string;
  repo: string;
  repository?: string;
  branch?: string;
  commitSha?: string;
}

/**
 * Result of linking operation
 */
export interface LinkResult {
  artifact: Artifact;
  isNew: boolean;
  relationships: ArtifactRelationship[];
}

/**
 * Link a class to an artifact
 */
export function linkClass(
  registry: ArtifactRegistry,
  classInfo: ClassInfo,
  config: LinkConfig,
  parentUrn?: string
): LinkResult {
  const source: ArtifactSource = {
    repository: config.repository,
    branch: config.branch,
    commitSha: config.commitSha,
    filePath: classInfo.filePath,
    lineRange: [classInfo.lineNumber, classInfo.lineNumber]
  };

  const templateId = classInfo.implements?.length
    ? 'c4-code-interface'
    : 'c4-code-class';

  const qualifier = parentUrn ? parseUrnName(parentUrn) : deriveQualifier(source);

  const identifier: ArtifactIdentifier = {
    org: config.org,
    repo: config.repo,
    category: 'code',
    name: sanitizeUrnPart(classInfo.name),
    qualifier
  };

  const artifact = createFromTemplate(templateId, identifier, {
    name: classInfo.name,
    filePath: classInfo.filePath,
    technology: classInfo.extends ? `extends ${classInfo.extends}` : 'TypeScript'
  }, {
    source,
    additionalTags: classInfo.isAbstract ? ['abstract'] : [],
    additionalProperties: {
      methodCount: classInfo.methods.length,
      propertyCount: classInfo.properties.length,
      ...(parentUrn && { parentUrn })
    }
  });

  const resolution = registerArtifact(registry, artifact);
  const relationships: ArtifactRelationship[] = [];

  // Create parent relationship if specified
  if (parentUrn) {
    const rel = createRelationship(
      parentUrn,
      artifact.urn,
      'contains',
      { label: 'contains', source }
    );
    registerRelationship(registry, rel);
    relationships.push(rel);
  }

  // Create extends relationship if class extends another
  if (classInfo.extends) {
    const parentClass = findArtifactByName(registry, classInfo.extends, 'code');
    if (parentClass) {
      const rel = createRelationship(
        artifact.urn,
        parentClass.urn,
        'specialization',
        { label: 'extends', source }
      );
      registerRelationship(registry, rel);
      relationships.push(rel);
    }
  }

  return {
    artifact: resolution.artifact!,
    isNew: resolution.isNew,
    relationships
  };
}

/**
 * Link a function to an artifact
 */
export function linkFunction(
  registry: ArtifactRegistry,
  funcInfo: FunctionInfo,
  config: LinkConfig,
  parentUrn?: string
): LinkResult {
  const source: ArtifactSource = {
    repository: config.repository,
    branch: config.branch,
    commitSha: config.commitSha,
    filePath: funcInfo.filePath,
    lineRange: [funcInfo.lineNumber, funcInfo.lineNumber]
  };

  const qualifier = parentUrn ? parseUrnName(parentUrn) : deriveQualifier(source);

  const identifier: ArtifactIdentifier = {
    org: config.org,
    repo: config.repo,
    category: 'code',
    name: sanitizeUrnPart(funcInfo.name),
    qualifier
  };

  const artifact = createFromTemplate('c4-code-function', identifier, {
    name: funcInfo.name,
    filePath: funcInfo.filePath
  }, {
    source,
    technology: funcInfo.returnType || 'function',
    additionalTags: funcInfo.isAsync ? ['async'] : [],
    additionalProperties: {
      parameterCount: funcInfo.parameters.length,
      isExported: funcInfo.isExported || false,
      ...(parentUrn && { parentUrn })
    }
  });

  const resolution = registerArtifact(registry, artifact);
  const relationships: ArtifactRelationship[] = [];

  if (parentUrn) {
    const rel = createRelationship(
      parentUrn,
      artifact.urn,
      'contains',
      { label: 'contains', source }
    );
    registerRelationship(registry, rel);
    relationships.push(rel);
  }

  return {
    artifact: resolution.artifact!,
    isNew: resolution.isNew,
    relationships
  };
}

/**
 * Link a module/directory to a container or component
 */
export function linkModule(
  registry: ArtifactRegistry,
  moduleInfo: ModuleInfo,
  config: LinkConfig,
  category: 'container' | 'component' = 'component',
  parentUrn?: string
): LinkResult {
  const source: ArtifactSource = {
    repository: config.repository,
    branch: config.branch,
    commitSha: config.commitSha,
    filePath: moduleInfo.path,
    packageName: moduleInfo.name
  };

  const templateId = category === 'container' ? 'c4-container' : 'c4-component';
  const technology = inferModuleTechnology(moduleInfo);

  const identifier: ArtifactIdentifier = {
    org: config.org,
    repo: config.repo,
    category,
    name: sanitizeUrnPart(moduleInfo.name),
    qualifier: parentUrn ? parseUrnName(parentUrn) : undefined
  };

  const artifact = createFromTemplate(templateId, identifier, {
    name: moduleInfo.name,
    technology
  }, {
    source,
    technology,
    additionalProperties: {
      moduleType: moduleInfo.type,
      exportCount: moduleInfo.exports?.length || 0,
      importCount: moduleInfo.imports?.length || 0,
      ...(parentUrn && { parentUrn })
    }
  });

  const resolution = registerArtifact(registry, artifact);
  const relationships: ArtifactRelationship[] = [];

  if (parentUrn) {
    const rel = createRelationship(
      parentUrn,
      artifact.urn,
      'contains',
      { label: 'contains', source }
    );
    registerRelationship(registry, rel);
    relationships.push(rel);
  }

  // Create import relationships
  if (moduleInfo.imports) {
    for (const importPath of moduleInfo.imports) {
      const importedModule = findArtifactByName(registry, importPath, category);
      if (importedModule) {
        const rel = createRelationship(
          artifact.urn,
          importedModule.urn,
          'depends_on',
          { label: 'imports', source }
        );
        registerRelationship(registry, rel);
        relationships.push(rel);
      }
    }
  }

  return {
    artifact: resolution.artifact!,
    isNew: resolution.isNew,
    relationships
  };
}

/**
 * Link an external dependency to an artifact
 */
export function linkDependency(
  registry: ArtifactRegistry,
  dep: DependencyInfo,
  config: LinkConfig,
  parentUrn?: string
): LinkResult {
  const identifier: ArtifactIdentifier = {
    org: config.org,
    repo: config.repo,
    category: 'external',
    name: sanitizeUrnPart(dep.name)
  };

  const artifact = createFromTemplate('c4-external-system', identifier, {
    name: dep.name
  }, {
    technology: dep.version,
    additionalTags: [dep.type, dep.category || 'library'],
    additionalProperties: {
      version: dep.version || 'unknown',
      dependencyType: dep.type,
      ...(parentUrn && { parentUrn })
    }
  });

  const resolution = registerArtifact(registry, artifact);
  const relationships: ArtifactRelationship[] = [];

  if (parentUrn) {
    const rel = createRelationship(
      parentUrn,
      artifact.urn,
      'depends_on',
      {
        label: `${dep.type} dependency`,
        technology: dep.version
      }
    );
    registerRelationship(registry, rel);
    relationships.push(rel);
  }

  return {
    artifact: resolution.artifact!,
    isNew: resolution.isNew,
    relationships
  };
}

/**
 * Create or find a system artifact for the repository
 */
export function ensureSystemArtifact(
  registry: ArtifactRegistry,
  config: LinkConfig,
  displayName: string,
  description?: string
): Artifact {
  const identifier: ArtifactIdentifier = {
    org: config.org,
    repo: config.repo,
    category: 'system',
    name: sanitizeUrnPart(config.repo)
  };

  const urn = generateUrn(identifier);
  const existing = registry.artifacts.get(urn);
  if (existing) return existing;

  const artifact = createFromTemplate('c4-system', identifier, {
    name: displayName
  }, {
    source: { repository: config.repository },
    additionalProperties: { description: description || '' }
  });

  registerArtifact(registry, artifact);
  return artifact;
}

/**
 * Infer relationship type from import/usage pattern
 */
export function inferRelationshipType(
  sourceArtifact: Artifact,
  targetArtifact: Artifact,
  usageHint?: string
): RelationshipType {
  // Database access patterns
  if (targetArtifact.tags?.includes('database') ||
      targetArtifact.technology?.toLowerCase().includes('sql')) {
    return usageHint?.includes('write') ? 'writes_to' : 'reads_from';
  }

  // API/Service patterns
  if (targetArtifact.tags?.includes('api') ||
      targetArtifact.tags?.includes('service')) {
    return 'calls';
  }

  // Container to container
  if (sourceArtifact.category === 'container' &&
      targetArtifact.category === 'container') {
    return 'uses';
  }

  // Default
  return 'depends_on';
}

/**
 * Extract name from URN
 */
function parseUrnName(urn: string): string {
  const parts = urn.split(':');
  return parts[parts.length - 1];
}

/**
 * Infer technology from module info
 */
function inferModuleTechnology(moduleInfo: ModuleInfo): string {
  const name = moduleInfo.name.toLowerCase();

  if (name.includes('controller') || name.includes('route')) return 'Controller';
  if (name.includes('service')) return 'Service';
  if (name.includes('repository') || name.includes('dao')) return 'Repository';
  if (name.includes('model') || name.includes('entity')) return 'Model';
  if (name.includes('util') || name.includes('helper')) return 'Utility';
  if (name.includes('middleware')) return 'Middleware';
  if (name.includes('api')) return 'API';

  return 'Module';
}

/**
 * Batch link multiple classes
 */
export function linkClasses(
  registry: ArtifactRegistry,
  classes: ClassInfo[],
  config: LinkConfig,
  parentUrn?: string
): LinkResult[] {
  return classes.map(c => linkClass(registry, c, config, parentUrn));
}

/**
 * Batch link multiple functions
 */
export function linkFunctions(
  registry: ArtifactRegistry,
  functions: FunctionInfo[],
  config: LinkConfig,
  parentUrn?: string
): LinkResult[] {
  return functions.map(f => linkFunction(registry, f, config, parentUrn));
}

/**
 * Batch link dependencies
 */
export function linkDependencies(
  registry: ArtifactRegistry,
  dependencies: DependencyInfo[],
  config: LinkConfig,
  parentUrn?: string
): LinkResult[] {
  return dependencies.map(d => linkDependency(registry, d, config, parentUrn));
}
