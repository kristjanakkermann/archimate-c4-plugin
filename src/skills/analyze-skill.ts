/**
 * Architecture Analyze Skill
 * Analyzes a codebase and generates architecture documentation
 *
 * Usage: /arch-analyze [options]
 *
 * Options:
 *   --output <format>  - Output format (c4, archimate, both)
 *   --depth <level>    - Analysis depth (shallow, normal, deep)
 *   --include-tests    - Include test files in analysis
 *   --save <path>      - Save documentation to file
 */

import type { SkillContext, SkillResult, DiagramOutput } from '../types/index.js';
import { ANALYSIS_PROMPTS } from '../analyzers/codebase-analyzer.js';

export const SKILL_NAME = 'architecture-analyze';
export const SKILL_COMMAND = 'arch-analyze';
export const SKILL_DESCRIPTION = 'Analyze codebase and generate architecture documentation';

export const SKILL_PROMPT = `You are an expert software architect tasked with analyzing a codebase and generating comprehensive architecture documentation.

## Analysis Process

Follow these steps to analyze the codebase:

### 1. Initial Exploration
- Examine the project structure (directories, key files)
- Read package.json or equivalent for dependencies
- Identify the technology stack and frameworks
- Find entry points (main files, app bootstrap)

### 2. Identify Architectural Patterns
- Determine the overall architecture pattern (monolith, microservices, serverless)
- Identify design patterns in use (MVC, Repository, Factory, etc.)
- Note any domain-driven design elements

### 3. Map the Structure

**For C4 Model:**
- **Context**: Identify users, external systems, and integrations
- **Containers**: Identify deployable units (web apps, APIs, databases, queues)
- **Components**: Within each container, identify major modules/services
- **Code**: For key components, identify important classes/functions

**For ArchiMate:**
- **Business Layer**: Business processes the system supports
- **Application Layer**: Application components and their services
- **Technology Layer**: Infrastructure and deployment

### 4. Identify Relationships
- Data flows between components
- API calls and integrations
- Database access patterns
- Event/message flows

### 5. Generate Documentation

Output the following:

1. **Executive Summary**: Brief overview of the system
2. **Technology Stack**: Languages, frameworks, databases, etc.
3. **Architecture Overview**: High-level description
4. **C4 Diagrams**: Context, Container, and Component diagrams
5. **ArchiMate Views**: Layered view showing all architectural layers
6. **Key Design Decisions**: Important architectural choices observed

## Analysis Instructions

${ANALYSIS_PROMPTS.identifyEntryPoints}

${ANALYSIS_PROMPTS.identifyModules}

${ANALYSIS_PROMPTS.identifyContainers}

${ANALYSIS_PROMPTS.identifyComponents}

${ANALYSIS_PROMPTS.inferRelationships}

## Output Format

Structure your output as:

\`\`\`markdown
# Architecture Documentation: [Project Name]

## Executive Summary
[Brief overview]

## Technology Stack
- Language: [...]
- Framework: [...]
- Database: [...]
- Other: [...]

## Architecture Overview
[Description of overall architecture]

## C4 Model

### System Context
[Description]
\`\`\`mermaid
[C4 context diagram]
\`\`\`

### Containers
[Description]
\`\`\`mermaid
[C4 container diagram]
\`\`\`

### Components
[Description for each container]
\`\`\`mermaid
[C4 component diagram]
\`\`\`

## ArchiMate Model

### Layered View
\`\`\`mermaid
[ArchiMate layered diagram]
\`\`\`

## Key Design Decisions
1. [Decision 1]
2. [Decision 2]
...
\`\`\`
`;

interface AnalyzeSkillArgs {
  output?: 'c4' | 'archimate' | 'both';
  depth?: 'shallow' | 'normal' | 'deep';
  includeTests?: boolean;
  save?: string;
}

/**
 * Parse skill arguments
 */
export function parseArgs(argsString?: string): AnalyzeSkillArgs {
  const args: AnalyzeSkillArgs = {
    output: 'both',
    depth: 'normal',
    includeTests: false
  };

  if (!argsString) return args;

  const parts = argsString.split(/\s+/);
  let i = 0;

  while (i < parts.length) {
    const part = parts[i];

    if (part === '--output' && parts[i + 1]) {
      args.output = parts[++i] as 'c4' | 'archimate' | 'both';
    } else if (part === '--depth' && parts[i + 1]) {
      args.depth = parts[++i] as 'shallow' | 'normal' | 'deep';
    } else if (part === '--include-tests') {
      args.includeTests = true;
    } else if (part === '--save' && parts[i + 1]) {
      args.save = parts[++i];
    }

    i++;
  }

  return args;
}

/**
 * Main skill execution
 */
export async function execute(context: SkillContext): Promise<SkillResult> {
  const args = parseArgs(context.args);

  // The actual analysis is performed by Claude using the SKILL_PROMPT
  // This function provides the framework for the analysis

  const output = `# Architecture Analysis

## Instructions

I will analyze the codebase in: \`${context.workingDirectory}\`

**Analysis Configuration:**
- Output Format: ${args.output}
- Analysis Depth: ${args.depth}
- Include Tests: ${args.includeTests}

Starting analysis...

Please use the file exploration tools to:
1. List the project structure
2. Read package.json or equivalent configuration
3. Identify entry points and key modules
4. Analyze dependencies and relationships

I will then generate:
${args.output === 'c4' || args.output === 'both' ? '- C4 Model diagrams (Context, Container, Component)\n' : ''}${args.output === 'archimate' || args.output === 'both' ? '- ArchiMate views (Layered, Application, Technology)\n' : ''}
`;

  return {
    success: true,
    output,
    diagrams: []
  };
}
