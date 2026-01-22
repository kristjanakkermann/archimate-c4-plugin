/**
 * ArchiMate Diagram Skill
 * Generates ArchiMate enterprise architecture diagrams
 *
 * Usage: /archimate [viewpoint] [options]
 *
 * Viewpoints:
 *   layered       - Full layered view (default)
 *   business      - Business layer view
 *   application   - Application layer view
 *   technology    - Technology layer view
 *   motivation    - Motivation elements view
 *
 * Options:
 *   --layers <l1,l2>  - Include specific layers
 *   --format <fmt>    - Output format (mermaid, plantuml)
 *   --direction <dir> - Diagram direction (TB, LR)
 *   --analyze         - Analyze current codebase first
 */

import type { SkillContext, SkillResult, DiagramOutput } from '../types/index.js';
import type {
  ArchiMateModel,
  ArchiMateElement,
  ArchiMateViewpoint,
  ArchiMateDiagramOptions,
  ArchiMateLayer
} from '../types/archimate.js';
import { ArchiMateMermaidGenerator, generateStandardArchiMateViews } from '../generators/archimate-mermaid.js';

export const SKILL_NAME = 'archimate-diagram';
export const SKILL_COMMAND = 'archimate';
export const SKILL_DESCRIPTION = 'Generate ArchiMate enterprise architecture diagrams';

export const SKILL_PROMPT = `You are an expert enterprise architect helping to create ArchiMate diagrams.

ArchiMate is a modeling language for describing enterprise architectures with three main layers:
- **Business Layer**: Business actors, processes, services, and objects
- **Application Layer**: Application components, services, interfaces, and data objects
- **Technology Layer**: Nodes, devices, system software, and artifacts

## ArchiMate Concepts

### Business Layer Elements
- Business Actor: Person or organization unit
- Business Role: Responsibility for behavior
- Business Process: Sequence of activities
- Business Service: Externally visible behavior
- Business Object: Information element

### Application Layer Elements
- Application Component: Modular, deployable software
- Application Service: Behavior exposed by component
- Application Interface: Access point for services
- Data Object: Digital information element

### Technology Layer Elements
- Node: Computational resource
- Device: Physical hardware
- System Software: Platform software
- Artifact: Physical data
- Technology Service: Infrastructure capability

### Relationships
- **Serving**: Provides functionality to
- **Realization**: Implements
- **Assignment**: Allocated to
- **Triggering**: Causes
- **Flow**: Transfer of information
- **Access**: Reads/writes data

## Your Task

Based on the user's request, generate appropriate ArchiMate diagrams. You should:

1. **If analyzing a codebase**: Map code elements to ArchiMate concepts:
   - Classes/Services → Application Components
   - APIs → Application Interfaces
   - Database tables → Data Objects
   - Infrastructure → Technology elements

2. **If designing enterprise architecture**: Ask about:
   - Business processes and stakeholders
   - Applications and integrations
   - Technology infrastructure
   - Goals and requirements

## Output Format

For each diagram, output:

\`\`\`mermaid
[diagram content]
\`\`\`

Along with an explanation of the architectural view.
`;

interface ArchiMateSkillArgs {
  viewpoint?: ArchiMateViewpoint;
  layers?: ArchiMateLayer[];
  format?: 'mermaid' | 'plantuml';
  direction?: 'TB' | 'LR';
  analyze?: boolean;
}

/**
 * Parse skill arguments from command line
 */
export function parseArgs(argsString?: string): ArchiMateSkillArgs {
  const args: ArchiMateSkillArgs = {
    viewpoint: 'layered',
    format: 'mermaid',
    direction: 'TB'
  };

  if (!argsString) return args;

  const parts = argsString.split(/\s+/);
  let i = 0;

  const viewpoints: ArchiMateViewpoint[] = [
    'layered', 'organization', 'businessProcessCooperation', 'product',
    'application', 'applicationCooperation', 'technology', 'technologyUsage',
    'implementation', 'migration', 'motivation', 'stakeholder', 'goalRealization'
  ];

  while (i < parts.length) {
    const part = parts[i];

    // Check for viewpoint aliases
    if (part === 'business') {
      args.viewpoint = 'businessProcessCooperation';
    } else if (viewpoints.includes(part as ArchiMateViewpoint)) {
      args.viewpoint = part as ArchiMateViewpoint;
    } else if (part === '--layers' && parts[i + 1]) {
      args.layers = parts[++i].split(',') as ArchiMateLayer[];
    } else if (part === '--format' && parts[i + 1]) {
      args.format = parts[++i] as 'mermaid' | 'plantuml';
    } else if (part === '--direction' && parts[i + 1]) {
      args.direction = parts[++i] as 'TB' | 'LR';
    } else if (part === '--analyze') {
      args.analyze = true;
    }

    i++;
  }

  return args;
}

/**
 * Generate diagram output from ArchiMate model
 */
export function generateDiagrams(model: ArchiMateModel, args: ArchiMateSkillArgs): DiagramOutput[] {
  const generator = new ArchiMateMermaidGenerator();
  const outputs: DiagramOutput[] = [];

  const options: ArchiMateDiagramOptions = {
    viewpoint: args.viewpoint,
    layers: args.layers,
    direction: args.direction,
    format: args.format
  };

  const content = generator.generate(model, options);

  outputs.push({
    id: `archimate-${args.viewpoint}`,
    title: `ArchiMate ${formatViewpointName(args.viewpoint || 'layered')} View`,
    type: 'archimate-layered',
    format: 'mermaid',
    content,
    description: getViewpointDescription(args.viewpoint || 'layered')
  });

  return outputs;
}

/**
 * Format viewpoint name for display
 */
function formatViewpointName(viewpoint: ArchiMateViewpoint): string {
  const names: Record<ArchiMateViewpoint, string> = {
    organization: 'Organization',
    businessProcessCooperation: 'Business Process Cooperation',
    product: 'Product',
    application: 'Application',
    applicationCooperation: 'Application Cooperation',
    technologyUsage: 'Technology Usage',
    technology: 'Technology',
    physicalEnvironment: 'Physical Environment',
    layered: 'Layered',
    implementation: 'Implementation & Migration',
    migration: 'Migration',
    stakeholder: 'Stakeholder',
    goalRealization: 'Goal Realization',
    requirementsRealization: 'Requirements Realization',
    motivation: 'Motivation'
  };
  return names[viewpoint] || viewpoint;
}

/**
 * Get description for viewpoint
 */
function getViewpointDescription(viewpoint: ArchiMateViewpoint): string {
  const descriptions: Record<ArchiMateViewpoint, string> = {
    organization: 'Shows the organizational structure with actors and roles',
    businessProcessCooperation: 'Shows business processes and their cooperation',
    product: 'Shows products and their composition',
    application: 'Shows application components and their services',
    applicationCooperation: 'Shows application collaboration and data flows',
    technologyUsage: 'Shows how applications use technology infrastructure',
    technology: 'Shows technology infrastructure elements',
    physicalEnvironment: 'Shows physical deployment environment',
    layered: 'Shows elements across all architectural layers',
    implementation: 'Shows implementation and migration planning',
    migration: 'Shows transition from baseline to target architecture',
    stakeholder: 'Shows stakeholders and their concerns',
    goalRealization: 'Shows goals and how they are realized',
    requirementsRealization: 'Shows requirements and their realization',
    motivation: 'Shows motivational elements driving the architecture'
  };
  return descriptions[viewpoint] || 'ArchiMate architectural view';
}

/**
 * Create an example ArchiMate model for demonstration
 */
export function createExampleArchiMateModel(): ArchiMateModel {
  return {
    name: 'Example Enterprise Architecture',
    description: 'Sample enterprise architecture for an e-commerce business',
    elements: [
      // Business Layer
      {
        id: 'customer',
        name: 'Customer',
        type: 'businessActor',
        layer: 'business',
        description: 'External customer'
      },
      {
        id: 'sales_role',
        name: 'Sales Representative',
        type: 'businessRole',
        layer: 'business',
        description: 'Handles customer sales'
      },
      {
        id: 'order_process',
        name: 'Order Processing',
        type: 'businessProcess',
        layer: 'business',
        description: 'End-to-end order handling'
      },
      {
        id: 'payment_process',
        name: 'Payment Processing',
        type: 'businessProcess',
        layer: 'business',
        description: 'Payment collection'
      },
      {
        id: 'order_service',
        name: 'Order Service',
        type: 'businessService',
        layer: 'business',
        description: 'Order placement capability'
      },
      {
        id: 'order_data',
        name: 'Order',
        type: 'businessObject',
        layer: 'business',
        description: 'Order information'
      },

      // Application Layer
      {
        id: 'web_store',
        name: 'Web Store',
        type: 'applicationComponent',
        layer: 'application',
        description: 'Customer-facing web application'
      },
      {
        id: 'order_api',
        name: 'Order API',
        type: 'applicationInterface',
        layer: 'application',
        description: 'REST API for orders'
      },
      {
        id: 'order_mgmt',
        name: 'Order Management System',
        type: 'applicationComponent',
        layer: 'application',
        description: 'Backend order processing'
      },
      {
        id: 'payment_gateway_comp',
        name: 'Payment Gateway Integration',
        type: 'applicationComponent',
        layer: 'application',
        description: 'Payment processing integration'
      },
      {
        id: 'order_db_obj',
        name: 'Order Record',
        type: 'dataObject',
        layer: 'application',
        description: 'Persisted order data'
      },

      // Technology Layer
      {
        id: 'web_server',
        name: 'Web Server',
        type: 'node',
        layer: 'technology',
        description: 'Application hosting'
      },
      {
        id: 'db_server',
        name: 'Database Server',
        type: 'node',
        layer: 'technology',
        description: 'PostgreSQL server'
      },
      {
        id: 'nodejs',
        name: 'Node.js Runtime',
        type: 'systemSoftware',
        layer: 'technology',
        description: 'JavaScript runtime'
      },
      {
        id: 'postgres',
        name: 'PostgreSQL',
        type: 'systemSoftware',
        layer: 'technology',
        description: 'Database system'
      },
      {
        id: 'docker',
        name: 'Docker Containers',
        type: 'artifact',
        layer: 'technology',
        description: 'Container images'
      }
    ],
    relationships: [
      // Business relationships
      {
        id: 'rel1',
        sourceId: 'customer',
        targetId: 'order_service',
        type: 'serving',
        name: 'uses'
      },
      {
        id: 'rel2',
        sourceId: 'sales_role',
        targetId: 'order_process',
        type: 'assignment'
      },
      {
        id: 'rel3',
        sourceId: 'order_process',
        targetId: 'order_service',
        type: 'realization'
      },
      {
        id: 'rel4',
        sourceId: 'order_process',
        targetId: 'payment_process',
        type: 'triggering'
      },
      {
        id: 'rel5',
        sourceId: 'order_process',
        targetId: 'order_data',
        type: 'access'
      },

      // Application relationships
      {
        id: 'rel6',
        sourceId: 'web_store',
        targetId: 'order_api',
        type: 'serving'
      },
      {
        id: 'rel7',
        sourceId: 'order_mgmt',
        targetId: 'order_api',
        type: 'realization'
      },
      {
        id: 'rel8',
        sourceId: 'order_mgmt',
        targetId: 'payment_gateway_comp',
        type: 'serving'
      },
      {
        id: 'rel9',
        sourceId: 'order_mgmt',
        targetId: 'order_db_obj',
        type: 'access'
      },

      // Cross-layer relationships
      {
        id: 'rel10',
        sourceId: 'web_store',
        targetId: 'order_service',
        type: 'realization'
      },
      {
        id: 'rel11',
        sourceId: 'order_db_obj',
        targetId: 'order_data',
        type: 'realization'
      },

      // Technology relationships
      {
        id: 'rel12',
        sourceId: 'nodejs',
        targetId: 'web_server',
        type: 'assignment'
      },
      {
        id: 'rel13',
        sourceId: 'postgres',
        targetId: 'db_server',
        type: 'assignment'
      },
      {
        id: 'rel14',
        sourceId: 'web_store',
        targetId: 'nodejs',
        type: 'realization'
      },
      {
        id: 'rel15',
        sourceId: 'order_db_obj',
        targetId: 'postgres',
        type: 'realization'
      }
    ],
    views: [
      {
        id: 'layered_view',
        name: 'Layered View',
        viewpoint: 'layered',
        elements: [],
        relationships: []
      }
    ],
    metadata: {
      version: '1.0',
      created: new Date().toISOString()
    }
  };
}

/**
 * Main skill execution
 */
export async function execute(context: SkillContext): Promise<SkillResult> {
  const args = parseArgs(context.args);

  // For demonstration, use example model
  const model = createExampleArchiMateModel();
  const diagrams = generateDiagrams(model, args);

  const output = diagrams.map(d => {
    return `## ${d.title}\n\n${d.description}\n\n\`\`\`mermaid\n${d.content}\n\`\`\``;
  }).join('\n\n---\n\n');

  return {
    success: true,
    output,
    diagrams
  };
}
