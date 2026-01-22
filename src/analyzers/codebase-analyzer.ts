/**
 * Codebase Analyzer
 * Extracts architectural information from a codebase for C4 and ArchiMate modeling
 */

import type {
  CodebaseInfo,
  ModuleInfo,
  ClassInfo,
  FunctionInfo,
  DependencyInfo
} from '../types/index.js';

import type {
  C4Model,
  C4SoftwareSystem,
  C4Container,
  C4Component,
  C4CodeElement
} from '../types/c4.js';

import type {
  ArchiMateModel,
  ArchiMateElement,
  ArchiMateRelationship
} from '../types/archimate.js';

export interface AnalyzerOptions {
  includeDependencies?: boolean;
  includeTests?: boolean;
  maxDepth?: number;
  excludePatterns?: string[];
}

/**
 * Analysis prompts for Claude to execute
 * These are instruction templates that guide the analysis
 */
export const ANALYSIS_PROMPTS = {
  identifyEntryPoints: `Identify the main entry points of this codebase. Look for:
- Main files (main.ts, index.ts, app.ts, server.ts)
- Package.json "main" and "bin" fields
- Framework-specific entry points (Next.js pages, Express app files)
Return a list of file paths.`,

  identifyModules: `Analyze the directory structure and identify logical modules/packages.
For each module, identify:
- Name and path
- Type (source, test, config, asset)
- Main exports
- Dependencies on other internal modules`,

  extractClasses: `For the given file, extract all class definitions including:
- Class name
- File path and line number
- Methods (public, private, protected)
- Properties
- Parent class (extends)
- Implemented interfaces
- Whether it's abstract`,

  extractFunctions: `For the given file, extract all function definitions including:
- Function name
- File path and line number
- Parameters with types
- Return type
- Whether it's async
- Whether it's exported`,

  identifyContainers: `Based on the codebase structure, identify C4 containers (deployable units).
Common patterns:
- Frontend applications (React, Vue, Angular apps)
- Backend services (API servers, microservices)
- Databases (based on ORM configs, migration files)
- Message queues (based on messaging library usage)
- Worker processes (background job handlers)`,

  identifyComponents: `For the given container, identify C4 components (major structural units).
Look for:
- Controllers/Routes (API endpoints)
- Services (business logic)
- Repositories/DAOs (data access)
- Utilities/Helpers
- Middleware
- Event handlers`,

  inferRelationships: `Analyze imports and dependencies to infer relationships between components.
Identify:
- Which components call which others
- Data flow direction
- Technology/protocol used (HTTP, gRPC, SQL, etc.)`,

  mapToArchiMate: `Map the identified elements to ArchiMate concepts:
- Classes/Services → Application Components
- APIs/Endpoints → Application Interfaces
- Database entities → Data Objects
- External services → Technology Services
- Configuration → Artifacts`
};

/**
 * Template for generating C4 model from analysis
 */
export function createC4ModelTemplate(codebaseInfo: CodebaseInfo): C4Model {
  const systemName = codebaseInfo.name || 'System';

  return {
    title: `${systemName} - C4 Model`,
    description: `C4 architecture model for ${systemName}`,
    people: [],
    systems: [
      {
        id: 'main_system',
        name: systemName,
        description: `The ${systemName} application`,
        containers: []
      }
    ],
    relationships: []
  };
}

/**
 * Template for generating ArchiMate model from analysis
 */
export function createArchiMateModelTemplate(codebaseInfo: CodebaseInfo): ArchiMateModel {
  return {
    name: `${codebaseInfo.name} - ArchiMate Model`,
    description: `Enterprise architecture model for ${codebaseInfo.name}`,
    elements: [],
    relationships: [],
    views: [],
    metadata: {
      created: new Date().toISOString(),
      version: '1.0'
    }
  };
}

/**
 * Convert module info to C4 container
 */
export function moduleToC4Container(module: ModuleInfo, technology: string): C4Container {
  return {
    id: sanitizeId(module.name),
    name: module.name,
    description: `Module at ${module.path}`,
    technology,
    components: []
  };
}

/**
 * Convert class info to C4 component
 */
export function classToC4Component(classInfo: ClassInfo): C4Component {
  return {
    id: sanitizeId(classInfo.name),
    name: classInfo.name,
    description: classInfo.extends ? `Extends ${classInfo.extends}` : 'Application component',
    technology: 'Class',
    codeElements: [{
      id: sanitizeId(`${classInfo.name}_class`),
      name: classInfo.name,
      type: 'class',
      filePath: classInfo.filePath,
      description: `Lines: ${classInfo.lineNumber}`
    }]
  };
}

/**
 * Convert to ArchiMate application component
 */
export function classToArchiMateElement(classInfo: ClassInfo): ArchiMateElement {
  return {
    id: sanitizeId(classInfo.name),
    name: classInfo.name,
    type: 'applicationComponent',
    layer: 'application',
    description: `Class in ${classInfo.filePath}`
  };
}

/**
 * Infer component type from naming conventions
 */
export function inferComponentType(name: string): string {
  const lowerName = name.toLowerCase();

  if (lowerName.includes('controller') || lowerName.includes('route')) {
    return 'Controller';
  }
  if (lowerName.includes('service')) {
    return 'Service';
  }
  if (lowerName.includes('repository') || lowerName.includes('dao')) {
    return 'Repository';
  }
  if (lowerName.includes('middleware')) {
    return 'Middleware';
  }
  if (lowerName.includes('handler')) {
    return 'Handler';
  }
  if (lowerName.includes('util') || lowerName.includes('helper')) {
    return 'Utility';
  }
  if (lowerName.includes('model') || lowerName.includes('entity')) {
    return 'Model';
  }
  if (lowerName.includes('factory')) {
    return 'Factory';
  }
  if (lowerName.includes('adapter')) {
    return 'Adapter';
  }

  return 'Component';
}

/**
 * Infer ArchiMate element type from code structure
 */
export function inferArchiMateType(classInfo: ClassInfo): ArchiMateElement['type'] {
  const name = classInfo.name.toLowerCase();

  if (name.includes('interface') || classInfo.implements?.length) {
    return 'applicationInterface';
  }
  if (name.includes('service')) {
    return 'applicationService';
  }
  if (name.includes('process') || name.includes('workflow')) {
    return 'applicationProcess';
  }
  if (name.includes('data') || name.includes('entity') || name.includes('model')) {
    return 'dataObject';
  }

  return 'applicationComponent';
}

/**
 * Sanitize string for use as ID
 */
export function sanitizeId(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

/**
 * Detect technology stack from package.json or other config files
 */
export function detectTechnologyStack(dependencies: DependencyInfo[]): {
  language: string;
  framework?: string;
  database?: string;
  messaging?: string;
} {
  const depNames = new Set(dependencies.map(d => d.name));

  const result: ReturnType<typeof detectTechnologyStack> = {
    language: 'TypeScript/JavaScript'
  };

  // Frameworks
  if (depNames.has('next')) result.framework = 'Next.js';
  else if (depNames.has('react')) result.framework = 'React';
  else if (depNames.has('vue')) result.framework = 'Vue.js';
  else if (depNames.has('angular')) result.framework = 'Angular';
  else if (depNames.has('express')) result.framework = 'Express';
  else if (depNames.has('fastify')) result.framework = 'Fastify';
  else if (depNames.has('nestjs') || depNames.has('@nestjs/core')) result.framework = 'NestJS';

  // Databases
  if (depNames.has('pg') || depNames.has('postgres')) result.database = 'PostgreSQL';
  else if (depNames.has('mysql') || depNames.has('mysql2')) result.database = 'MySQL';
  else if (depNames.has('mongodb') || depNames.has('mongoose')) result.database = 'MongoDB';
  else if (depNames.has('redis') || depNames.has('ioredis')) result.database = 'Redis';
  else if (depNames.has('prisma') || depNames.has('@prisma/client')) result.database = 'Prisma ORM';

  // Messaging
  if (depNames.has('amqplib') || depNames.has('rabbitmq')) result.messaging = 'RabbitMQ';
  else if (depNames.has('kafkajs') || depNames.has('kafka-node')) result.messaging = 'Kafka';
  else if (depNames.has('bull') || depNames.has('bullmq')) result.messaging = 'Bull Queue';

  return result;
}

/**
 * Generate relationship ID
 */
export function generateRelationshipId(sourceId: string, targetId: string): string {
  return `rel_${sourceId}_${targetId}`;
}
