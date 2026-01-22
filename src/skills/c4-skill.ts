/**
 * C4 Diagram Skill
 * Generates C4 model diagrams for codebases
 *
 * Usage: /c4 [level] [options]
 *
 * Levels:
 *   context   - System context diagram (Level 1)
 *   container - Container diagram (Level 2)
 *   component - Component diagram (Level 3)
 *   code      - Code diagram (Level 4)
 *   all       - Generate all levels
 *
 * Options:
 *   --scope <id>      - Focus on specific element
 *   --format <fmt>    - Output format (mermaid, plantuml)
 *   --direction <dir> - Diagram direction (TB, LR, BT, RL)
 *   --analyze         - Analyze current codebase first
 */

import type { SkillContext, SkillResult, DiagramOutput } from '../types/index.js';
import type { C4Model, C4Level, C4DiagramOptions } from '../types/c4.js';
import { C4MermaidGenerator, generateAllC4Diagrams } from '../generators/c4-mermaid.js';

export const SKILL_NAME = 'c4-diagram';
export const SKILL_COMMAND = 'c4';
export const SKILL_DESCRIPTION = 'Generate C4 model diagrams (Context, Container, Component, Code)';

export const SKILL_PROMPT = `You are an expert software architect helping to create C4 model diagrams.

The C4 model is a way to visualize software architecture at different levels of abstraction:
- **Level 1 (Context)**: Shows the system in scope and its relationships with users and other systems
- **Level 2 (Container)**: Shows the high-level technology choices (web apps, databases, etc.)
- **Level 3 (Component)**: Shows the major structural building blocks within a container
- **Level 4 (Code)**: Shows how a component is implemented (classes, interfaces)

## Your Task

Based on the user's request, generate appropriate C4 diagrams. You should:

1. **If analyzing a codebase**: Use the file system tools to explore the code structure, identify:
   - Entry points and main modules
   - Services, controllers, repositories
   - External dependencies and integrations
   - Database and messaging components

2. **If designing from scratch**: Ask clarifying questions about:
   - Who are the users of the system?
   - What external systems does it integrate with?
   - What are the main containers (web app, API, database)?
   - What are the key components in each container?

3. **Generate diagrams**: Output Mermaid diagrams that can be rendered.

## Output Format

For each diagram, output:

\`\`\`mermaid
[diagram content]
\`\`\`

Along with a brief explanation of what the diagram shows.

## C4 Best Practices

- Keep diagrams focused and readable (5-20 elements max)
- Use consistent naming conventions
- Include descriptions for all elements
- Show technology choices where relevant
- Indicate which systems/components are external
- Use arrows to show dependencies and data flow
`;

interface C4SkillArgs {
  level?: C4Level | 'all';
  scope?: string;
  format?: 'mermaid' | 'plantuml';
  direction?: 'TB' | 'LR' | 'BT' | 'RL';
  analyze?: boolean;
}

/**
 * Parse skill arguments from command line
 */
export function parseArgs(argsString?: string): C4SkillArgs {
  const args: C4SkillArgs = {
    level: 'context',
    format: 'mermaid',
    direction: 'TB'
  };

  if (!argsString) return args;

  const parts = argsString.split(/\s+/);
  let i = 0;

  while (i < parts.length) {
    const part = parts[i];

    if (['context', 'container', 'component', 'code', 'all'].includes(part)) {
      args.level = part as C4Level | 'all';
    } else if (part === '--scope' && parts[i + 1]) {
      args.scope = parts[++i];
    } else if (part === '--format' && parts[i + 1]) {
      args.format = parts[++i] as 'mermaid' | 'plantuml';
    } else if (part === '--direction' && parts[i + 1]) {
      args.direction = parts[++i] as 'TB' | 'LR' | 'BT' | 'RL';
    } else if (part === '--analyze') {
      args.analyze = true;
    }

    i++;
  }

  return args;
}

/**
 * Generate diagram output from C4 model
 */
export function generateDiagrams(model: C4Model, args: C4SkillArgs): DiagramOutput[] {
  const generator = new C4MermaidGenerator();
  const outputs: DiagramOutput[] = [];

  const levels: C4Level[] = args.level === 'all'
    ? ['context', 'container', 'component', 'code']
    : [args.level || 'context'];

  for (const level of levels) {
    try {
      const options: C4DiagramOptions = {
        level,
        scope: args.scope,
        direction: args.direction,
        format: args.format
      };

      const content = generator.generate(model, options);

      outputs.push({
        id: `c4-${level}`,
        title: `C4 ${level.charAt(0).toUpperCase() + level.slice(1)} Diagram`,
        type: `c4-${level}` as DiagramOutput['type'],
        format: 'mermaid',
        content,
        description: getC4LevelDescription(level)
      });
    } catch (error) {
      // Skip levels that can't be generated (e.g., no containers for container diagram)
    }
  }

  return outputs;
}

/**
 * Get description for C4 level
 */
function getC4LevelDescription(level: C4Level): string {
  switch (level) {
    case 'context':
      return 'System context showing users, the system, and external dependencies';
    case 'container':
      return 'Container diagram showing deployable units within the system';
    case 'component':
      return 'Component diagram showing major building blocks within a container';
    case 'code':
      return 'Code diagram showing classes and interfaces';
  }
}

/**
 * Create an example C4 model for demonstration
 */
export function createExampleC4Model(): C4Model {
  return {
    title: 'Example E-Commerce System',
    description: 'A sample e-commerce platform architecture',
    people: [
      {
        id: 'customer',
        name: 'Customer',
        description: 'A user who browses and purchases products'
      },
      {
        id: 'admin',
        name: 'Administrator',
        description: 'Internal user who manages products and orders'
      }
    ],
    systems: [
      {
        id: 'ecommerce',
        name: 'E-Commerce System',
        description: 'The main e-commerce platform',
        containers: [
          {
            id: 'web_app',
            name: 'Web Application',
            description: 'Customer-facing web store',
            technology: 'React, TypeScript',
            components: [
              {
                id: 'product_catalog',
                name: 'Product Catalog',
                description: 'Displays products to customers',
                technology: 'React Components'
              },
              {
                id: 'shopping_cart',
                name: 'Shopping Cart',
                description: 'Manages cart state',
                technology: 'React Context'
              },
              {
                id: 'checkout',
                name: 'Checkout',
                description: 'Handles order placement',
                technology: 'React Components'
              }
            ]
          },
          {
            id: 'api',
            name: 'API Server',
            description: 'Backend REST API',
            technology: 'Node.js, Express',
            components: [
              {
                id: 'product_controller',
                name: 'Product Controller',
                description: 'Handles product API requests',
                technology: 'Express Router'
              },
              {
                id: 'order_service',
                name: 'Order Service',
                description: 'Processes orders',
                technology: 'Business Logic'
              },
              {
                id: 'user_repository',
                name: 'User Repository',
                description: 'Data access for users',
                technology: 'Prisma ORM'
              }
            ]
          },
          {
            id: 'database',
            name: 'Database',
            description: 'Primary data store',
            technology: 'PostgreSQL'
          }
        ]
      },
      {
        id: 'payment_gateway',
        name: 'Payment Gateway',
        description: 'External payment processing',
        external: true
      },
      {
        id: 'email_service',
        name: 'Email Service',
        description: 'External email delivery',
        external: true
      }
    ],
    relationships: [
      {
        sourceId: 'customer',
        targetId: 'web_app',
        description: 'Browses and purchases',
        technology: 'HTTPS'
      },
      {
        sourceId: 'admin',
        targetId: 'api',
        description: 'Manages products and orders',
        technology: 'HTTPS'
      },
      {
        sourceId: 'web_app',
        targetId: 'api',
        description: 'Makes API calls',
        technology: 'REST/JSON'
      },
      {
        sourceId: 'api',
        targetId: 'database',
        description: 'Reads/writes data',
        technology: 'SQL'
      },
      {
        sourceId: 'api',
        targetId: 'payment_gateway',
        description: 'Processes payments',
        technology: 'HTTPS'
      },
      {
        sourceId: 'api',
        targetId: 'email_service',
        description: 'Sends notifications',
        technology: 'SMTP'
      }
    ]
  };
}

/**
 * Main skill execution
 */
export async function execute(context: SkillContext): Promise<SkillResult> {
  const args = parseArgs(context.args);

  // For demonstration, use example model
  // In real usage, this would analyze the codebase or use user-provided model
  const model = createExampleC4Model();
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
